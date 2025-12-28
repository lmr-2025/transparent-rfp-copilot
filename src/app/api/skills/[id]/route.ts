import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { updateSkillSchema, validateBody } from "@/lib/validations";
import { logSkillChange, getUserFromSession, computeChanges } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { invalidateSkillCache } from "@/lib/cache";
import { getSkillSlug } from "@/lib/skillFiles";
import { updateSkillAndCommit, deleteSkillAndCommit } from "@/lib/skillGitSync";
import { withSyncLogging } from "@/lib/skillSyncLog";
import type { SkillFile } from "@/lib/skillFiles";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/skills/[id] - Get a single skill
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    const skill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      return errors.notFound("Skill");
    }

    return apiSuccess({ skill });
  } catch (error) {
    logger.error("Failed to fetch skill", error, { route: "/api/skills/[id]" });
    return errors.internal("Failed to fetch skill");
  }
}

// PUT /api/skills/[id] - Update a skill
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    const validation = validateBody(updateSkillSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;

    // Get existing skill
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) {
      return errors.notFound("Skill");
    }

    // Use client-provided history if present, otherwise add a generic update entry
    let finalHistory;
    if (data.history !== undefined) {
      // Client provided history - use it directly
      finalHistory = data.history;
    } else {
      // No history provided - add generic update entry
      const existingHistory = (existing.history as Array<{
        date: string;
        action: string;
        summary: string;
        user?: string;
      }>) || [];
      finalHistory = [
        ...existingHistory,
        {
          date: new Date().toISOString(),
          action: "updated",
          summary: "Skill updated",
          user: auth.session.user.email,
        },
      ];
    }

    // Build update data - only include fields that were provided
    // This prevents accidentally clearing fields that weren't in the update
    const updateData: Record<string, unknown> = {
      history: finalHistory,
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.categories !== undefined) updateData.categories = data.categories;
    if (data.tier !== undefined) updateData.tier = data.tier;
    if (data.tierOverrides !== undefined) updateData.tierOverrides = data.tierOverrides;
    if (data.quickFacts !== undefined) updateData.quickFacts = data.quickFacts;
    if (data.edgeCases !== undefined) updateData.edgeCases = data.edgeCases;
    if (data.sourceUrls !== undefined) updateData.sourceUrls = data.sourceUrls;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.owners !== undefined) updateData.owners = data.owners;
    if (data.lastRefreshedAt !== undefined) updateData.lastRefreshedAt = new Date(data.lastRefreshedAt);

    const skill = await prisma.skill.update({
      where: { id },
      data: updateData,
    });

    // Commit to git (only if PUBLISHED - reviews disabled)
    if (skill.status === "PUBLISHED") {
      try {
        const oldSlug = getSkillSlug(existing.title);
        const newSlug = getSkillSlug(skill.title);

        // Build commit message with change summary
        const changedFields = Object.keys(updateData).filter(
          (key) => key !== "history" && updateData[key] !== undefined
        );
        const changesSummary = changedFields.length > 0
          ? `\n\nChanges: ${changedFields.join(", ")}`
          : "";

        // Parse owners for git commit
        const owners = [
          ...(skill.ownerId && auth.session.user
            ? [
                {
                  name: auth.session.user.name || "Unknown",
                  email: auth.session.user.email || undefined,
                  userId: skill.ownerId,
                },
              ]
            : []),
          ...((skill.owners as Array<{ name: string; email?: string; userId?: string }>) || []),
        ];

        const skillFile: SkillFile = {
          id: skill.id,
          slug: newSlug,
          title: skill.title,
          content: skill.content,
          categories: skill.categories,
          owners,
          sources: (skill.sourceUrls as SkillFile["sources"]) || [],
          created: skill.createdAt.toISOString(),
          updated: skill.updatedAt.toISOString(),
          active: skill.isActive,
        };

        // Commit to git with sync logging
        await withSyncLogging(
          {
            skillId: skill.id,
            operation: "update",
            direction: "db-to-git",
            syncedBy: auth.session.user.id,
          },
          async () => {
            const commitSha = await updateSkillAndCommit(
              oldSlug,
              skillFile,
              `Update skill: ${skill.title}${changesSummary}`,
              {
                name: auth.session.user.name || auth.session.user.email || "Unknown",
                email: auth.session.user.email || "unknown@example.com",
              }
            );

            logger.info("Skill update committed to git", { skillId: skill.id, oldSlug, newSlug, commitSha });
            return commitSha;
          }
        );
      } catch (gitError) {
        // Log git error but don't fail the request
        logger.error("Failed to commit skill update to git", gitError, {
          skillId: skill.id,
          title: skill.title,
        });
      }
    }

    // Determine the action type for audit log
    let auditAction: "UPDATED" | "OWNER_ADDED" | "OWNER_REMOVED" | "REFRESHED" = "UPDATED";
    if (data.owners !== undefined) {
      const existingOwners = (existing.owners as Array<{ userId?: string; name: string }>) || [];
      const newOwners = data.owners || [];
      if (newOwners.length > existingOwners.length) {
        auditAction = "OWNER_ADDED";
      } else if (newOwners.length < existingOwners.length) {
        auditAction = "OWNER_REMOVED";
      }
    }

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      skill as unknown as Record<string, unknown>,
      ["title", "content", "categories", "quickFacts", "edgeCases", "sourceUrls", "isActive", "owners"]
    );

    // Audit log
    await logSkillChange(
      auditAction,
      skill.id,
      skill.title,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
    );

    // Invalidate cache since skill was updated
    await invalidateSkillCache();

    return apiSuccess({ skill });
  } catch (error) {
    logger.error("Failed to update skill", error, { route: "/api/skills/[id]" });
    const message = error instanceof Error ? error.message : "Failed to update skill";
    return errors.internal(message);
  }
}

// DELETE /api/skills/[id] - Delete a skill
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    // Get skill before deleting for audit log
    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      return errors.notFound("Skill");
    }

    await prisma.skill.delete({
      where: { id },
    });

    // Delete from git (only if skill was published)
    if (skill.status === "PUBLISHED") {
      try {
        const slug = getSkillSlug(skill.title);

        // Delete from git with sync logging
        await withSyncLogging(
          {
            skillId: skill.id,
            operation: "delete",
            direction: "db-to-git",
            syncedBy: auth.session.user.id,
          },
          async () => {
            const commitSha = await deleteSkillAndCommit(
              slug,
              `Delete skill: ${skill.title}`,
              {
                name: auth.session.user.name || auth.session.user.email || "Unknown",
                email: auth.session.user.email || "unknown@example.com",
              }
            );

            logger.info("Skill deletion committed to git", { skillId: skill.id, slug, commitSha });
            return commitSha;
          }
        );
      } catch (gitError) {
        // Log git error but don't fail the request
        logger.error("Failed to commit skill deletion to git", gitError, {
          skillId: skill.id,
          title: skill.title,
        });
      }
    }

    // Audit log
    await logSkillChange(
      "DELETED",
      id,
      skill.title,
      getUserFromSession(auth.session),
      undefined,
      { deletedSkill: { title: skill.title, categories: skill.categories } }
    );

    // Invalidate cache since skill was deleted
    await invalidateSkillCache();

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to delete skill", error, { route: "/api/skills/[id]" });
    return errors.internal("Failed to delete skill");
  }
}
