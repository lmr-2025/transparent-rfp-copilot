import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { hasCapability, roleToCapabilities } from "@/lib/capabilities";

// POST /api/users/migrate-capabilities - Migrate existing users to capabilities system
// Converts legacy role to capabilities for users who don't have capabilities set
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

    // Find users with empty capabilities array (not yet migrated)
    const usersToMigrate = await prisma.user.findMany({
      where: {
        capabilities: { isEmpty: true },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    const results = {
      migrated: 0,
      errors: [] as string[],
    };

    for (const user of usersToMigrate) {
      try {
        const capabilities = roleToCapabilities(user.role);

        await prisma.user.update({
          where: { id: user.id },
          data: { capabilities },
        });

        results.migrated++;
      } catch (err) {
        results.errors.push(`Failed to migrate ${user.email}: ${err}`);
      }
    }

    logger.info("Migrated users to capabilities", {
      migrated: results.migrated,
      errors: results.errors.length,
      migratedBy: session.user.email,
    });

    return apiSuccess({
      message: `Migrated ${results.migrated} users to capabilities system`,
      totalFound: usersToMigrate.length,
      ...results,
    });
  } catch (error) {
    logger.error("Error migrating users to capabilities", error);
    return errors.internal("Failed to migrate users");
  }
}
