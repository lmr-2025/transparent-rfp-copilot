import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// POST /api/migrate - Migrate localStorage data to database
// Admin-only: This endpoint can bulk-insert data
export async function POST(request: NextRequest) {
  // Require admin access for bulk data migration
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const results = {
      skills: { imported: 0, skipped: 0 },
      categories: { imported: 0, skipped: 0 },
      referenceUrls: { imported: 0, skipped: 0 },
    };

    // Migrate skills
    if (body.skills && Array.isArray(body.skills)) {
      for (const skill of body.skills) {
        try {
          // Check if skill with same title exists
          const existing = await prisma.skill.findFirst({
            where: { title: skill.title },
          });

          if (existing) {
            results.skills.skipped++;
            continue;
          }

          await prisma.skill.create({
            data: {
              id: skill.id,
              title: skill.title,
              content: skill.content || "",
              categories: skill.categories || (skill.category ? [skill.category] : []),
              quickFacts: skill.quickFacts || [],
              edgeCases: skill.edgeCases || [],
              sourceUrls: skill.sourceUrls || [],
              isActive: skill.isActive ?? true,
              createdAt: skill.createdAt ? new Date(skill.createdAt) : new Date(),
              lastRefreshedAt: skill.lastRefreshedAt ? new Date(skill.lastRefreshedAt) : null,
              owners: skill.owners,
              history: skill.history,
            },
          });
          results.skills.imported++;
        } catch (e) {
          logger.error("Failed to migrate skill", e, { route: "/api/migrate", skillTitle: skill.title });
          results.skills.skipped++;
        }
      }
    }

    // Migrate categories
    if (body.categories && Array.isArray(body.categories)) {
      for (let i = 0; i < body.categories.length; i++) {
        const cat = body.categories[i];
        try {
          await prisma.skillCategory.upsert({
            where: { name: cat.name },
            create: {
              name: cat.name,
              description: cat.description,
              color: cat.color,
              sortOrder: i,
              createdAt: cat.createdAt ? new Date(cat.createdAt) : new Date(),
            },
            update: {
              description: cat.description,
              color: cat.color,
              sortOrder: i,
            },
          });
          results.categories.imported++;
        } catch (e) {
          logger.error("Failed to migrate category", e, { route: "/api/migrate", categoryName: cat.name });
          results.categories.skipped++;
        }
      }
    }

    // Migrate reference URLs
    if (body.referenceUrls && Array.isArray(body.referenceUrls)) {
      for (const urlData of body.referenceUrls) {
        try {
          const url = typeof urlData === "string" ? urlData : urlData.url;
          await prisma.referenceUrl.upsert({
            where: { url },
            create: {
              url,
              title: typeof urlData === "object" ? urlData.title : undefined,
              description: typeof urlData === "object" ? urlData.description : undefined,
              categories: typeof urlData === "object" && urlData.category ? [urlData.category] : [],
            },
            update: {},
          });
          results.referenceUrls.imported++;
        } catch (e) {
          logger.error("Failed to migrate reference URL", e, { route: "/api/migrate" });
          results.referenceUrls.skipped++;
        }
      }
    }

    return apiSuccess({
      success: true,
      message: "Migration completed",
      results,
    });
  } catch (error) {
    logger.error("Migration failed", error, { route: "/api/migrate" });
    return errors.internal(`Migration failed: ${String(error)}`);
  }
}
