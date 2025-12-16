import { loadRateLimitSettings } from "@/lib/appSettings";
import { apiSuccess } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET /api/app-settings/rate-limits - Get rate limit settings (public for frontend use)
// These settings are not sensitive and needed by the batch generation UI
export async function GET() {
  try {
    const settings = await loadRateLimitSettings();
    return apiSuccess(settings);
  } catch (error) {
    logger.error("Failed to load rate limit settings", error, { route: "/api/app-settings/rate-limits" });
    // Return defaults on error
    return apiSuccess({
      batchSize: 5,
      batchDelayMs: 15000,
      rateLimitRetryWaitMs: 60000,
      rateLimitMaxRetries: 3,
      provider: "anthropic",
    });
  }
}
