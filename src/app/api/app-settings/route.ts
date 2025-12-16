import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { createAuditLog, getUserFromSession } from "@/lib/auditLog";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Default values for rate limit settings
export const DEFAULT_RATE_LIMIT_SETTINGS = {
  LLM_BATCH_SIZE: "5",
  LLM_BATCH_DELAY_MS: "15000",
  LLM_RATE_LIMIT_RETRY_WAIT_MS: "60000",
  LLM_RATE_LIMIT_MAX_RETRIES: "3",
  LLM_PROVIDER: "anthropic", // "anthropic" or "bedrock"
};

// GET /api/app-settings - Get all app settings (admin only)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const settings = await prisma.appSetting.findMany({
      where: {
        // Only return non-sensitive settings or masked versions
        isSecret: false,
      },
      orderBy: { key: "asc" },
    });

    // Include default values for any missing settings
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const allSettings = Object.entries(DEFAULT_RATE_LIMIT_SETTINGS).map(([key, defaultValue]) => ({
      key,
      value: settingsMap.get(key) || defaultValue,
      description: getSettingDescription(key),
      isDefault: !settingsMap.has(key),
    }));

    return apiSuccess({ settings: allSettings });
  } catch (error) {
    logger.error("Failed to fetch app settings", error, { route: "/api/app-settings" });
    return errors.internal("Failed to fetch app settings");
  }
}

// POST /api/app-settings - Update app settings (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return errors.badRequest("key is required");
    }

    // Only allow rate limit related keys
    const allowedKeys = Object.keys(DEFAULT_RATE_LIMIT_SETTINGS);
    if (!allowedKeys.includes(key)) {
      return errors.badRequest(`Setting '${key}' is not a valid app setting`);
    }

    // Validate numeric values
    if (key !== "LLM_PROVIDER") {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 0) {
        return errors.badRequest(`'${key}' must be a positive number`);
      }
    } else {
      // Validate provider
      if (!["anthropic", "bedrock"].includes(value)) {
        return errors.badRequest(`'${key}' must be 'anthropic' or 'bedrock'`);
      }
    }

    const updatedBy = auth.session.user.email || auth.session.user.id;

    // Upsert the setting
    const setting = await prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: String(value),
        description: getSettingDescription(key),
        isSecret: false,
        updatedBy,
      },
      update: {
        value: String(value),
        updatedBy,
      },
    });

    // Audit log
    await createAuditLog({
      entityType: "SETTING",
      entityId: key,
      entityTitle: key,
      action: "UPDATED",
      user: getUserFromSession(auth.session),
      metadata: { newValue: value },
    });

    return apiSuccess({ success: true, setting });
  } catch (error) {
    logger.error("Failed to update app setting", error, { route: "/api/app-settings" });
    return errors.internal("Failed to update setting");
  }
}

function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    LLM_BATCH_SIZE: "Number of questions to process in each batch API call",
    LLM_BATCH_DELAY_MS: "Milliseconds to wait between batch API calls (rate limit protection)",
    LLM_RATE_LIMIT_RETRY_WAIT_MS: "Milliseconds to wait before retrying after a rate limit error",
    LLM_RATE_LIMIT_MAX_RETRIES: "Maximum number of retry attempts after rate limit errors",
    LLM_PROVIDER: "LLM provider to use: 'anthropic' (direct API) or 'bedrock' (AWS Bedrock)",
  };
  return descriptions[key] || "";
}
