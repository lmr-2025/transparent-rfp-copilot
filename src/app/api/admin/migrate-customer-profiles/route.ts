import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type KeyFact = {
  label: string;
  value: string;
};

/**
 * POST /api/admin/migrate-customer-profiles
 *
 * Migrates existing customer profiles to use the new `content` field
 * by combining legacy fields (overview, products, challenges, keyFacts)
 * into a single markdown-structured content field.
 *
 * This is idempotent - profiles that already have content are skipped.
 */
export async function POST() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  // Require admin capability
  if (!auth.session?.user?.capabilities?.includes("ADMIN")) {
    return errors.forbidden("Admin access required");
  }

  try {
    // Find all profiles that don't have content field populated
    const profilesToMigrate = await prisma.customerProfile.findMany({
      where: {
        content: null,
      },
      select: {
        id: true,
        name: true,
        overview: true,
        products: true,
        challenges: true,
        keyFacts: true,
      },
    });

    if (profilesToMigrate.length === 0) {
      return apiSuccess({
        message: "No profiles need migration",
        migratedCount: 0,
        totalProfiles: await prisma.customerProfile.count(),
      });
    }

    // Migrate each profile
    const results = await Promise.all(
      profilesToMigrate.map(async (profile) => {
        try {
          const content = buildContentFromLegacyFields(profile);

          await prisma.customerProfile.update({
            where: { id: profile.id },
            data: { content },
          });

          return { id: profile.id, name: profile.name, success: true };
        } catch (error) {
          logger.error("Failed to migrate profile", error, { profileId: profile.id });
          return { id: profile.id, name: profile.name, success: false, error: String(error) };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    logger.info("Customer profile migration completed", {
      successCount,
      failedCount,
      totalAttempted: profilesToMigrate.length,
    });

    return apiSuccess({
      message: `Migration completed: ${successCount} profiles migrated, ${failedCount} failed`,
      migratedCount: successCount,
      failedCount,
      totalProfiles: await prisma.customerProfile.count(),
      results,
    });
  } catch (error) {
    logger.error("Customer profile migration failed", error);
    return errors.internal("Migration failed");
  }
}

function buildContentFromLegacyFields(profile: {
  overview: string;
  products: string | null;
  challenges: string | null;
  keyFacts: unknown;
}): string {
  const parts: string[] = [];

  // Overview (always present)
  if (profile.overview) {
    parts.push(`## Overview\n${profile.overview}`);
  }

  // Products & Services
  if (profile.products) {
    parts.push(`## Products & Services\n${profile.products}`);
  }

  // Challenges & Needs
  if (profile.challenges) {
    parts.push(`## Challenges & Needs\n${profile.challenges}`);
  }

  // Key Facts
  const keyFacts = profile.keyFacts as KeyFact[] | null;
  if (keyFacts && Array.isArray(keyFacts) && keyFacts.length > 0) {
    const factsText = keyFacts
      .map(f => `- **${f.label}:** ${f.value}`)
      .join("\n");
    parts.push(`## Key Facts\n${factsText}`);
  }

  return parts.join("\n\n");
}

// GET endpoint to check migration status
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  if (!auth.session?.user?.capabilities?.includes("ADMIN")) {
    return errors.forbidden("Admin access required");
  }

  try {
    const totalProfiles = await prisma.customerProfile.count();
    const migratedProfiles = await prisma.customerProfile.count({
      where: { content: { not: null } },
    });
    const pendingProfiles = totalProfiles - migratedProfiles;

    return apiSuccess({
      totalProfiles,
      migratedProfiles,
      pendingProfiles,
      migrationComplete: pendingProfiles === 0,
    });
  } catch (error) {
    logger.error("Failed to check migration status", error);
    return errors.internal("Failed to check migration status");
  }
}
