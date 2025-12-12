import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/migrate - Migrate localStorage data to database
// This is called from the frontend with the localStorage data
export async function POST(request: NextRequest) {
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
              tags: skill.tags || [],
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
          console.error("Failed to migrate skill:", skill.title, e);
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
          console.error("Failed to migrate category:", cat.name, e);
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
              category: typeof urlData === "object" ? urlData.category : undefined,
            },
            update: {},
          });
          results.referenceUrls.imported++;
        } catch (e) {
          console.error("Failed to migrate reference URL:", urlData, e);
          results.referenceUrls.skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed",
      results,
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json(
      { error: "Migration failed", details: String(error) },
      { status: 500 }
    );
  }
}
