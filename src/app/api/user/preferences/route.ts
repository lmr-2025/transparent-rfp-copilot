import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { LLM_SPEED_DEFAULTS, type LLMFeature, type ModelSpeed } from "@/lib/config";

// Validation schema for LLM speed overrides
const llmSpeedOverridesSchema = z.record(
  z.string(),
  z.enum(["fast", "quality"])
).optional().nullable();

const updatePreferencesSchema = z.object({
  llmSpeedOverrides: llmSpeedOverridesSchema,
});

// GET /api/user/preferences - Get current user's preferences
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    // Get or create user preferences
    let preferences = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    });

    if (!preferences) {
      // Create default preferences
      preferences = await prisma.userPreference.create({
        data: {
          userId: session.user.id,
          llmSpeedOverrides: Prisma.JsonNull,
        },
      });
    }

    // Build response with system defaults for reference
    const llmSpeedOverrides = preferences.llmSpeedOverrides as Record<string, ModelSpeed> | null;

    return apiSuccess({
      preferences: {
        llmSpeedOverrides: llmSpeedOverrides || {},
      },
      systemDefaults: LLM_SPEED_DEFAULTS,
      // Helper: effective settings (user overrides merged with system defaults)
      effectiveSettings: Object.fromEntries(
        Object.entries(LLM_SPEED_DEFAULTS).map(([feature, defaultSpeed]) => [
          feature,
          llmSpeedOverrides?.[feature] || defaultSpeed,
        ])
      ) as Record<LLMFeature, ModelSpeed>,
    });
  } catch (error) {
    logger.error("Failed to get user preferences", error, { route: "/api/user/preferences" });
    return errors.internal("Failed to load preferences");
  }
}

// PUT /api/user/preferences - Update current user's preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return errors.unauthorized();
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest("Invalid JSON body");
    }

    const validation = updatePreferencesSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.issues.map(e => e.message).join(", "));
    }

    const { llmSpeedOverrides } = validation.data;

    // Clean up overrides: remove entries that match system defaults
    let cleanedOverrides: Record<string, ModelSpeed> | null = null;
    if (llmSpeedOverrides && Object.keys(llmSpeedOverrides).length > 0) {
      const filteredEntries = Object.entries(llmSpeedOverrides).filter(
        ([feature, speed]) => {
          const defaultSpeed = LLM_SPEED_DEFAULTS[feature as LLMFeature];
          return defaultSpeed && speed !== defaultSpeed;
        }
      );
      cleanedOverrides = filteredEntries.length > 0
        ? Object.fromEntries(filteredEntries)
        : null;
    }

    // Upsert preferences
    const preferences = await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        llmSpeedOverrides: cleanedOverrides ?? Prisma.JsonNull,
      },
      update: {
        llmSpeedOverrides: cleanedOverrides ?? Prisma.JsonNull,
      },
    });

    const savedOverrides = preferences.llmSpeedOverrides as Record<string, ModelSpeed> | null;

    return apiSuccess({
      preferences: {
        llmSpeedOverrides: savedOverrides || {},
      },
      effectiveSettings: Object.fromEntries(
        Object.entries(LLM_SPEED_DEFAULTS).map(([feature, defaultSpeed]) => [
          feature,
          savedOverrides?.[feature] || defaultSpeed,
        ])
      ) as Record<LLMFeature, ModelSpeed>,
    });
  } catch (error) {
    logger.error("Failed to update user preferences", error, { route: "/api/user/preferences" });
    return errors.internal("Failed to save preferences");
  }
}
