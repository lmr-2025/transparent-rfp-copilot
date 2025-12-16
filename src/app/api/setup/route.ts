import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, isEncryptionConfigured } from "@/lib/encryption";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Keys that contain sensitive data and should be encrypted
const SENSITIVE_KEY_PATTERNS = ["SECRET", "TOKEN", "KEY", "PASSWORD", "CREDENTIAL"];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => key.toUpperCase().includes(pattern));
}

// GET /api/setup - Check if setup is needed
export async function GET() {
  // Check if any users exist
  const userCount = await prisma.user.count();

  // Check if Google OAuth is configured
  const googleConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  // Check if Okta is configured
  const oktaConfigured = !!(
    process.env.OKTA_CLIENT_ID &&
    process.env.OKTA_CLIENT_SECRET &&
    process.env.OKTA_ISSUER
  );

  return apiSuccess({
    setupNeeded: userCount === 0 && !googleConfigured && !oktaConfigured,
    hasUsers: userCount > 0,
    googleConfigured,
    oktaConfigured,
    devMode: process.env.NODE_ENV !== "production",
  });
}

// POST /api/setup - Save initial OAuth credentials (only works if no users exist)
export async function POST(request: NextRequest) {
  // Security: Only allow setup if no users exist yet
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return errors.forbidden("Setup already complete. Use admin settings to modify.");
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return errors.badRequest("key is required");
    }

    // Only allow OAuth-related keys during setup
    const allowedKeys = [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "OKTA_CLIENT_ID",
      "OKTA_CLIENT_SECRET",
      "OKTA_ISSUER",
    ];

    if (!allowedKeys.includes(key)) {
      return errors.badRequest(`Setting '${key}' cannot be set during setup`);
    }

    const isSensitive = isSensitiveKey(key);

    // Require encryption to be configured for sensitive values
    if (isSensitive && !isEncryptionConfigured()) {
      return errors.internal("ENCRYPTION_KEY environment variable must be configured to store sensitive settings");
    }

    // Encrypt sensitive values before storing
    const valueToStore = isSensitive && value ? encrypt(value) : (value || "");

    // Store in database
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: valueToStore, updatedBy: "setup-wizard" },
      update: { value: valueToStore, updatedBy: "setup-wizard" },
    });

    return apiSuccess({ success: true, key });
  } catch (error) {
    logger.error("Setup error", error, { route: "/api/setup" });
    return errors.internal("Failed to save setting");
  }
}
