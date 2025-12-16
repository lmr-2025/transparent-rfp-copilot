import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getUserFromSession } from "@/lib/auditLog";
import { encrypt, isEncryptionConfigured } from "@/lib/encryption";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Settings are stored in a simple key-value table
// Sensitive values (secrets, tokens, keys) are encrypted at rest using AES-256-GCM

// Keys that contain sensitive data and should be encrypted
const SENSITIVE_KEY_PATTERNS = ["SECRET", "TOKEN", "KEY", "PASSWORD", "CREDENTIAL"];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => key.toUpperCase().includes(pattern));
}

type IntegrationStatus = {
  configured: boolean;
  lastTestedAt?: string;
  error?: string;
};

type SettingsResponse = {
  integrations: {
    salesforce: IntegrationStatus;
    slack: IntegrationStatus;
    anthropic: IntegrationStatus;
    google: IntegrationStatus;
  };
  // Non-sensitive settings that can be displayed
  appSettings: {
    maxFileUploadMb: number;
    defaultModel: string;
  };
};

// GET /api/admin/settings - Get current settings status (admin only)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const response: SettingsResponse = {
    integrations: {
      salesforce: {
        configured: !!(
          process.env.SALESFORCE_CLIENT_ID &&
          process.env.SALESFORCE_CLIENT_SECRET &&
          process.env.SALESFORCE_REFRESH_TOKEN &&
          process.env.SALESFORCE_INSTANCE_URL
        ),
      },
      slack: {
        configured: !!process.env.SLACK_WEBHOOK_URL,
      },
      anthropic: {
        configured: !!process.env.ANTHROPIC_API_KEY,
      },
      google: {
        configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
    },
    appSettings: {
      maxFileUploadMb: 10,
      defaultModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    },
  };

  return apiSuccess(response);
}

// POST /api/admin/settings - Update settings (admin only)
// Sensitive values are encrypted using AES-256-GCM before storage
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

    // Whitelist of allowed settings keys
    const allowedKeys = [
      "SALESFORCE_CLIENT_ID",
      "SALESFORCE_CLIENT_SECRET",
      "SALESFORCE_REFRESH_TOKEN",
      "SALESFORCE_INSTANCE_URL",
      "SLACK_WEBHOOK_URL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "OKTA_CLIENT_ID",
      "OKTA_CLIENT_SECRET",
      "OKTA_ISSUER",
    ];

    if (!allowedKeys.includes(key)) {
      return errors.badRequest(`Setting '${key}' cannot be modified via API`);
    }

    const isSensitive = isSensitiveKey(key);

    // Require encryption to be configured for sensitive values
    if (isSensitive && !isEncryptionConfigured()) {
      return errors.internal("ENCRYPTION_KEY environment variable must be configured to store sensitive settings");
    }

    // Get existing value for audit log
    const existing = await prisma.appSetting.findUnique({ where: { key } });
    const isCreate = !existing;

    // Encrypt sensitive values before storing
    const valueToStore = isSensitive && value ? encrypt(value) : (value || "");

    // Store in database (AppSetting table)
    await prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: valueToStore,
        updatedBy: auth.session?.user?.email || "unknown",
      },
      update: {
        value: valueToStore,
        updatedBy: auth.session?.user?.email || "unknown",
      },
    });

    // Audit log the setting change (never log sensitive values)
    await createAuditLog({
      entityType: "SETTING",
      entityId: key,
      entityTitle: key,
      action: isCreate ? "CREATED" : "UPDATED",
      user: auth.session ? getUserFromSession(auth.session) : undefined,
      changes: isSensitive ? undefined : {
        value: {
          from: existing?.value || null,
          to: value || "",
        },
      },
      metadata: isSensitive ? { note: "Sensitive value changed (encrypted, not logged)" } : undefined,
    });

    return apiSuccess({ success: true, key, encrypted: isSensitive });
  } catch (error) {
    logger.error("Failed to update setting", error, { route: "/api/admin/settings" });
    return errors.internal("Failed to update setting");
  }
}

// DELETE /api/admin/settings - Remove a setting (admin only)
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return errors.badRequest("key parameter required");
    }

    const existing = await prisma.appSetting.findUnique({ where: { key } });

    if (existing) {
      await prisma.appSetting.delete({ where: { key } });

      // Audit log the deletion
      await createAuditLog({
        entityType: "SETTING",
        entityId: key,
        entityTitle: key,
        action: "DELETED",
        user: auth.session ? getUserFromSession(auth.session) : undefined,
      });
    }

    return apiSuccess({ success: true, key });
  } catch (error) {
    logger.error("Failed to delete setting", error, { route: "/api/admin/settings" });
    return errors.internal("Failed to delete setting");
  }
}
