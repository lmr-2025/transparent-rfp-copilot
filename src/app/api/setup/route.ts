import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, isEncryptionConfigured } from "@/lib/encryption";

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

  return NextResponse.json({
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
    return NextResponse.json(
      { error: "Setup already complete. Use admin settings to modify." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
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
      return NextResponse.json(
        { error: `Setting '${key}' cannot be set during setup` },
        { status: 400 }
      );
    }

    const isSensitive = isSensitiveKey(key);

    // Require encryption to be configured for sensitive values
    if (isSensitive && !isEncryptionConfigured()) {
      return NextResponse.json(
        { error: "ENCRYPTION_KEY environment variable must be configured to store sensitive settings" },
        { status: 500 }
      );
    }

    // Encrypt sensitive values before storing
    const valueToStore = isSensitive && value ? encrypt(value) : (value || "");

    // Store in database
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: valueToStore, updatedBy: "setup-wizard" },
      update: { value: valueToStore, updatedBy: "setup-wizard" },
    });

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Failed to save setting" },
      { status: 500 }
    );
  }
}
