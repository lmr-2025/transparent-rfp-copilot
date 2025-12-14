import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

// Settings are stored in a simple key-value table
// Sensitive values are encrypted at rest (TODO: security engineer to implement)

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

  return NextResponse.json(response);
}

// POST /api/admin/settings - Update settings (admin only)
// NOTE: This is a light implementation. Security engineer should:
// 1. Encrypt sensitive values before storing
// 2. Add audit logging
// 3. Implement proper secret management (e.g., Vault, AWS Secrets Manager)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
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
      return NextResponse.json(
        { error: `Setting '${key}' cannot be modified via API` },
        { status: 400 }
      );
    }

    // Store in database (AppSetting table)
    // TODO: Security engineer - encrypt value before storing
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: value || "", updatedBy: auth.session?.user?.email || "unknown" },
      update: { value: value || "", updatedBy: auth.session?.user?.email || "unknown" },
    });

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("Failed to update setting:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "key parameter required" }, { status: 400 });
    }

    await prisma.appSetting.delete({
      where: { key },
    }).catch(() => {
      // Ignore if doesn't exist
    });

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("Failed to delete setting:", error);
    return NextResponse.json(
      { error: "Failed to delete setting" },
      { status: 500 }
    );
  }
}
