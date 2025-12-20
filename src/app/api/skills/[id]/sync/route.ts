import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getSkillSlug } from "@/lib/skillFiles";
import { updateSkillAndCommit } from "@/lib/skillGitSync";
import { withSyncLogging } from "@/lib/skillSyncLog";
import type { SkillFile } from "@/lib/skillFiles";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/skills/[id]/sync - Manually sync a skill to Git
 *
 * This endpoint allows manual triggering of git sync regardless of skill status.
 * Useful for:
 * - Skills created before sync tracking was enabled
 * - Skills that failed to sync automatically
 * - Draft skills that need to be synced
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await context.params;

    // Get the skill
    const skill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      return errors.notFound("Skill");
    }

    // Build skill file for git
    const slug = getSkillSlug(skill.title);

    // Parse owners
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
      slug,
      title: skill.title,
      content: skill.content,
      categories: skill.categories,
      owners,
      sources: (skill.sourceUrls as SkillFile["sources"]) || [],
      created: skill.createdAt.toISOString(),
      updated: skill.updatedAt.toISOString(),
      active: skill.isActive,
    };

    // Sync to git with logging
    let commitSha: string | null = null;

    await withSyncLogging(
      {
        skillId: skill.id,
        operation: "update",
        direction: "db-to-git",
        syncedBy: auth.session.user.id,
      },
      async () => {
        commitSha = await updateSkillAndCommit(
          slug,
          skillFile,
          `Manual sync: ${skill.title}`,
          {
            name: auth.session.user.name || auth.session.user.email || "Unknown",
            email: auth.session.user.email || "unknown@example.com",
          }
        );

        logger.info("Manual skill sync committed to git", {
          skillId: skill.id,
          slug,
          commitSha
        });

        return commitSha;
      }
    );

    return apiSuccess({
      message: "Skill synced to Git successfully",
      commitSha: commitSha ?? undefined,
      skillId: skill.id,
      slug,
    });
  } catch (error) {
    logger.error("Failed to manually sync skill", error, {
      route: "/api/skills/[id]/sync"
    });
    const message = error instanceof Error ? error.message : "Failed to sync skill";
    return errors.internal(message);
  }
}
