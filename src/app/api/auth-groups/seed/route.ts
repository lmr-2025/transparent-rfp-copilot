import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { hasCapability, defaultGroupMappings } from "@/lib/capabilities";

// POST /api/auth-groups/seed - Seed default auth group mappings
// Only creates mappings that don't already exist
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errors.unauthorized("Authentication required");
    }

    const userCapabilities = session.user.capabilities || [];
    if (!hasCapability(userCapabilities, "ADMIN")) {
      return errors.forbidden("ADMIN capability required");
    }

    // Default provider for seeded mappings (can be configured via env)
    const defaultProvider = process.env.DEFAULT_SSO_PROVIDER || "okta";

    const results = {
      created: [] as string[],
      skipped: [] as string[],
    };

    for (const mapping of defaultGroupMappings) {
      // Check if already exists
      const existing = await prisma.authGroupMapping.findUnique({
        where: {
          provider_groupId: {
            provider: defaultProvider,
            groupId: mapping.groupId,
          },
        },
      });

      if (existing) {
        results.skipped.push(mapping.groupId);
        continue;
      }

      // Create the mapping
      await prisma.authGroupMapping.create({
        data: {
          provider: defaultProvider,
          groupId: mapping.groupId,
          groupName: mapping.groupName,
          capabilities: mapping.capabilities,
        },
      });

      results.created.push(mapping.groupId);
    }

    logger.info("Seeded auth group mappings", {
      created: results.created.length,
      skipped: results.skipped.length,
      seededBy: session.user.email,
    });

    return apiSuccess({
      message: `Created ${results.created.length} mappings, skipped ${results.skipped.length} existing`,
      ...results,
    });
  } catch (error) {
    logger.error("Error seeding auth group mappings", error);
    return errors.internal("Failed to seed auth group mappings");
  }
}
