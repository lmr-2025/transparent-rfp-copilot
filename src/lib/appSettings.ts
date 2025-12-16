import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Default values for rate limit settings
export const DEFAULT_RATE_LIMIT_SETTINGS = {
  LLM_BATCH_SIZE: 5,
  LLM_BATCH_DELAY_MS: 15000,
  LLM_RATE_LIMIT_RETRY_WAIT_MS: 60000,
  LLM_RATE_LIMIT_MAX_RETRIES: 3,
  LLM_PROVIDER: "anthropic" as const,
};

export type LLMProvider = "anthropic" | "bedrock";

export type RateLimitSettings = {
  batchSize: number;
  batchDelayMs: number;
  rateLimitRetryWaitMs: number;
  rateLimitMaxRetries: number;
  provider: LLMProvider;
};

/**
 * Load rate limit settings from the database, with fallback to defaults.
 * This is called on each batch generation to allow live updates without restart.
 */
export async function loadRateLimitSettings(): Promise<RateLimitSettings> {
  try {
    const settings = await prisma.appSetting.findMany({
      where: {
        key: {
          in: Object.keys(DEFAULT_RATE_LIMIT_SETTINGS),
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    return {
      batchSize: parseInt(settingsMap.get("LLM_BATCH_SIZE") || "", 10) || DEFAULT_RATE_LIMIT_SETTINGS.LLM_BATCH_SIZE,
      batchDelayMs: parseInt(settingsMap.get("LLM_BATCH_DELAY_MS") || "", 10) || DEFAULT_RATE_LIMIT_SETTINGS.LLM_BATCH_DELAY_MS,
      rateLimitRetryWaitMs: parseInt(settingsMap.get("LLM_RATE_LIMIT_RETRY_WAIT_MS") || "", 10) || DEFAULT_RATE_LIMIT_SETTINGS.LLM_RATE_LIMIT_RETRY_WAIT_MS,
      rateLimitMaxRetries: parseInt(settingsMap.get("LLM_RATE_LIMIT_MAX_RETRIES") || "", 10) || DEFAULT_RATE_LIMIT_SETTINGS.LLM_RATE_LIMIT_MAX_RETRIES,
      provider: (settingsMap.get("LLM_PROVIDER") as LLMProvider) || DEFAULT_RATE_LIMIT_SETTINGS.LLM_PROVIDER,
    };
  } catch (error) {
    logger.warn("Failed to load rate limit settings, using defaults", error);
    return {
      batchSize: DEFAULT_RATE_LIMIT_SETTINGS.LLM_BATCH_SIZE,
      batchDelayMs: DEFAULT_RATE_LIMIT_SETTINGS.LLM_BATCH_DELAY_MS,
      rateLimitRetryWaitMs: DEFAULT_RATE_LIMIT_SETTINGS.LLM_RATE_LIMIT_RETRY_WAIT_MS,
      rateLimitMaxRetries: DEFAULT_RATE_LIMIT_SETTINGS.LLM_RATE_LIMIT_MAX_RETRIES,
      provider: DEFAULT_RATE_LIMIT_SETTINGS.LLM_PROVIDER,
    };
  }
}

/**
 * Get a single app setting value
 */
export async function getAppSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key },
    });
    return setting?.value || defaultValue;
  } catch {
    return defaultValue;
  }
}
