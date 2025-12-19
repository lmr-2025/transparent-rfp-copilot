import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { CustomerProfileHistoryEntry } from "@/types/customerProfile";
import { requireAuth } from "@/lib/apiAuth";
import { updateCustomerSchema, validateBody } from "@/lib/validations";
import { logCustomerChange, getUserFromSession, computeChanges } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getCustomerSlug } from "@/lib/customerFiles";
import { updateCustomerAndCommit, deleteCustomerAndCommit } from "@/lib/customerGitSync";
import { withCustomerSyncLogging } from "@/lib/customerSyncLog";
import type { CustomerFile } from "@/lib/customerFiles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/customers/[id] - Get single customer profile
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const { id } = params;

    const profile = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!profile) {
      return errors.notFound("Customer profile");
    }

    return apiSuccess({ profile });
  } catch (error) {
    logger.error("Failed to fetch customer profile", error, { route: "/api/customers/[id]" });
    return errors.internal("Failed to fetch customer profile");
  }
}

// PUT /api/customers/[id] - Update customer profile
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();

    const validation = validateBody(updateCustomerSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const {
      name,
      industry,
      website,
      overview,
      products,
      challenges,
      keyFacts,
      sourceUrls,
      isActive,
      owners,
    } = validation.data;

    // lastRefreshedAt comes from body directly (not in schema - it's a system field)
    const lastRefreshedAt = body.lastRefreshedAt;

    // Get existing profile to append to history and compute changes
    const existing = await prisma.customerProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound("Customer profile");
    }

    // Build history entry
    const historyEntry: CustomerProfileHistoryEntry = {
      date: new Date().toISOString(),
      action: lastRefreshedAt ? "refreshed" : "updated",
      summary: lastRefreshedAt
        ? "Profile refreshed from sources"
        : "Profile updated",
      user: auth.session.user.email,
    };

    const existingHistory = (existing.history as CustomerProfileHistoryEntry[]) || [];

    const profile = await prisma.customerProfile.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(industry !== undefined && { industry: industry || null }),
        ...(website !== undefined && { website: website || null }),
        ...(overview !== undefined && { overview }),
        ...(products !== undefined && { products: products || null }),
        ...(challenges !== undefined && { challenges: challenges || null }),
        ...(keyFacts !== undefined && { keyFacts }),
        ...(sourceUrls !== undefined && { sourceUrls }),
        ...(isActive !== undefined && { isActive }),
        ...(owners !== undefined && { owners: owners || undefined }),
        ...(lastRefreshedAt !== undefined && {
          lastRefreshedAt: new Date(lastRefreshedAt),
        }),
        history: [...existingHistory, historyEntry],
      },
    });

    // Commit to git (Phase 2 of git-first architecture)
    try {
      const oldSlug = getCustomerSlug(existing.name);
      const newSlug = getCustomerSlug(profile.name);

      // Build content from legacy fields if no unified content
      let content = profile.content || "";
      if (!content && profile.overview) {
        const sections: string[] = [];
        if (profile.overview) sections.push(`## Overview\n${profile.overview}`);
        if (profile.products) sections.push(`## Products & Services\n${profile.products}`);
        if (profile.challenges) sections.push(`## Challenges & Pain Points\n${profile.challenges}`);
        const facts = profile.keyFacts as Array<{ label: string; value: string }> | null;
        if (facts && facts.length > 0) {
          const factsSection = facts.map((f) => `- **${f.label}**: ${f.value}`).join("\n");
          sections.push(`## Key Facts\n${factsSection}`);
        }
        content = `# ${profile.name}\n\n${sections.join("\n\n")}`;
      }

      // Parse owners for git commit
      const customerOwners = (profile.owners as Array<{ name: string; email?: string; userId?: string }>) || [];

      // Parse source URLs
      const sources = (profile.sourceUrls as Array<{ url: string; addedAt: string; lastFetched?: string }>) || [];

      // Parse source documents
      const sourceDocuments = (profile.sourceDocuments as Array<{ id: string; filename: string; uploadedAt: string }>) || undefined;

      const customerFile: CustomerFile = {
        id: profile.id,
        slug: newSlug,
        name: profile.name,
        content,
        industry: profile.industry || undefined,
        website: profile.website || undefined,
        salesforceId: profile.salesforceId || undefined,
        region: profile.region || undefined,
        tier: profile.tier || undefined,
        employeeCount: profile.employeeCount || undefined,
        annualRevenue: profile.annualRevenue || undefined,
        accountType: profile.accountType || undefined,
        billingLocation: profile.billingLocation || undefined,
        lastSalesforceSync: profile.lastSalesforceSync?.toISOString(),
        owners: customerOwners,
        sources,
        documents: sourceDocuments,
        considerations: profile.considerations || [],
        created: profile.createdAt.toISOString(),
        updated: profile.updatedAt.toISOString(),
        active: profile.isActive,
      };

      // Commit to git with sync logging
      await withCustomerSyncLogging(
        {
          customerId: profile.id,
          operation: lastRefreshedAt ? "refresh" : "update",
          direction: "db-to-git",
          syncedBy: auth.session.user.id,
        },
        async () => {
          const commitSha = await updateCustomerAndCommit(
            oldSlug,
            customerFile,
            `Update customer profile: ${profile.name}`,
            {
              name: auth.session.user.name || auth.session.user.email || "Unknown",
              email: auth.session.user.email || "unknown@example.com",
            }
          );

          logger.info("Customer profile update committed to git", { customerId: profile.id, oldSlug, newSlug, commitSha });
          return commitSha;
        }
      );
    } catch (gitError) {
      // Log git error but don't fail the request
      logger.error("Failed to commit customer profile update to git", gitError, {
        customerId: profile.id,
        name: profile.name,
      });
    }

    // Compute changes for audit log
    const changes = computeChanges(
      existing as unknown as Record<string, unknown>,
      profile as unknown as Record<string, unknown>,
      ["name", "industry", "website", "overview", "products", "challenges", "keyFacts", "sourceUrls", "isActive", "owners"]
    );

    // Audit log
    await logCustomerChange(
      lastRefreshedAt ? "REFRESHED" : "UPDATED",
      profile.id,
      profile.name,
      getUserFromSession(auth.session),
      Object.keys(changes).length > 0 ? changes : undefined
    );

    return apiSuccess({ profile });
  } catch (error) {
    logger.error("Failed to update customer profile", error, { route: "/api/customers/[id]" });
    return errors.internal("Failed to update customer profile");
  }
}

// DELETE /api/customers/[id] - Delete customer profile
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { id } = params;

    // Use transaction to prevent race condition between check and delete
    const result = await prisma.$transaction(async (tx) => {
      // Check if profile is linked to any projects
      const linkedProjects = await tx.projectCustomerProfile.count({
        where: { profileId: id },
      });

      if (linkedProjects > 0) {
        throw new Error(`LINKED:${linkedProjects}`);
      }

      // Get profile before deleting for audit log
      const profile = await tx.customerProfile.findUnique({ where: { id } });

      if (!profile) {
        throw new Error("NOT_FOUND");
      }

      await tx.customerProfile.delete({
        where: { id },
      });

      return profile;
    });

    // Delete from git (Phase 2 of git-first architecture)
    try {
      const slug = getCustomerSlug(result.name);

      // Delete from git with sync logging
      await withCustomerSyncLogging(
        {
          customerId: result.id,
          operation: "delete",
          direction: "db-to-git",
          syncedBy: auth.session.user.id,
        },
        async () => {
          const commitSha = await deleteCustomerAndCommit(
            slug,
            `Delete customer profile: ${result.name}`,
            {
              name: auth.session.user.name || auth.session.user.email || "Unknown",
              email: auth.session.user.email || "unknown@example.com",
            }
          );

          logger.info("Customer profile deletion committed to git", { customerId: result.id, slug, commitSha });
          return commitSha;
        }
      );
    } catch (gitError) {
      // Log git error but don't fail the request
      logger.error("Failed to commit customer profile deletion to git", gitError, {
        customerId: result.id,
        name: result.name,
      });
    }

    // Audit log (outside transaction - non-critical)
    await logCustomerChange(
      "DELETED",
      id,
      result.name,
      getUserFromSession(auth.session),
      undefined,
      { deletedProfile: { name: result.name, industry: result.industry } }
    );

    return apiSuccess({ message: "Customer profile deleted successfully" });
  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.startsWith("LINKED:")) {
        const count = error.message.split(":")[1];
        return errors.badRequest(
          `Cannot delete profile: it is linked to ${count} project(s). Remove the associations first.`
        );
      }
      if (error.message === "NOT_FOUND") {
        return errors.notFound("Customer profile");
      }
    }
    logger.error("Failed to delete customer profile", error, { route: "/api/customers/[id]" });
    return errors.internal("Failed to delete customer profile");
  }
}
