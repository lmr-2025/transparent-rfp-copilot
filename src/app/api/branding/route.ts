import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        return NextResponse.json({ branding });
      } catch {
        // Invalid JSON, return defaults
        return NextResponse.json({ branding: null });
      }
    }

    return NextResponse.json({ branding: null });
  } catch (error) {
    console.error("Failed to fetch branding:", error);
    // Return null branding on error - frontend will use defaults
    return NextResponse.json({ branding: null });
  }
}
