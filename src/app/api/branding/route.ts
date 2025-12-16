import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Public endpoint - no auth required
// Returns branding settings for the app
export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "branding" },
    });

    if (setting?.value) {
      try {
        const branding = JSON.parse(setting.value);
        return apiSuccess({ branding });
      } catch {
        // Invalid JSON, return defaults
        return apiSuccess({ branding: null });
      }
    }

    return apiSuccess({ branding: null });
  } catch (error) {
    logger.error("Failed to fetch branding", error, { route: "/api/branding" });
    // Return null branding on error - frontend will use defaults
    return apiSuccess({ branding: null });
  }
}
