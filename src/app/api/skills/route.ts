import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { createSkillSchema, validateBody } from "@/lib/validations";
import { logSkillChange, getUserFromSession, getRequestContext } from "@/lib/auditLog";
import { logger } from "@/lib/logger";

/**
 * GET /api/skills - List all skills
 *
 * @description Retrieves skills from the database with optional filtering.
 * Returns skills ordered by most recently updated first.
 *
 * @authentication Required - returns 401 if not authenticated
 *
 * @query {string} [active="true"] - Filter by active status ("true" or "false")
 * @query {string} [category] - Filter by category name (use "all" for no filter)
 * @query {number} [limit=100] - Maximum skills to return (max 500)
 * @query {number} [offset=0] - Number of skills to skip (for pagination)
 *
 * @returns {Skill[]} 200 - Array of skill objects with owner information
 * @returns {{ error: string }} 401 - Unauthorized
 * @returns {{ error: string }} 500 - Server error
 *
 * @example
 * // Get active skills in Security category
 * GET /api/skills?active=true&category=Security&limit=50
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") !== "false";
    const category = searchParams.get("category");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: {
      isActive?: boolean;
      categories?: { has: string };
    } = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (category && category !== "all") {
      where.categories = { has: category };
    }

    const skills = await prisma.skill.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Transform to include owner in owners array if not already present
    const transformedSkills = skills.map((skill) => {
      const existingOwners = (skill.owners as Array<{ userId?: string; name: string; email?: string; image?: string }>) || [];

      // If there's an owner relation but not in owners array, add it
      if (skill.owner && !existingOwners.some((o) => o.userId === skill.owner?.id)) {
        existingOwners.unshift({
          userId: skill.owner.id,
          name: skill.owner.name || skill.owner.email || "Unknown",
          email: skill.owner.email || undefined,
          image: skill.owner.image || undefined,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { owner: _owner, ...skillWithoutRelation } = skill;
      return {
        ...skillWithoutRelation,
        owners: existingOwners.length > 0 ? existingOwners : undefined,
      };
    });

    return NextResponse.json(transformedSkills);
  } catch (error) {
    logger.error("Failed to fetch skills", error, { route: "/api/skills" });
    return NextResponse.json(
      { error: "Failed to fetch skills" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/skills - Create a new skill
 *
 * @description Creates a new skill in the database. The authenticated user
 * becomes the owner of the skill automatically.
 *
 * @authentication Required - returns 401 if not authenticated
 *
 * @body {string} title - Skill title (required)
 * @body {string} content - Main skill content/knowledge (required)
 * @body {string[]} [categories] - Category names this skill belongs to
 * @body {QuickFact[]} [quickFacts] - Array of {question, answer} pairs
 * @body {string[]} [edgeCases] - Special cases or caveats
 * @body {SourceUrl[]} [sourceUrls] - Array of {url, addedAt, lastFetchedAt}
 * @body {boolean} [isActive=true] - Whether skill is active
 * @body {Owner[]} [owners] - Additional owners beyond the creator
 *
 * @returns {Skill} 201 - Created skill object
 * @returns {{ error: string }} 400 - Validation error
 * @returns {{ error: string }} 401 - Unauthorized
 * @returns {{ error: string }} 500 - Server error
 *
 * @example
 * POST /api/skills
 * { "title": "SOC2 Compliance", "content": "Our SOC2 Type II..." }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    const validation = validateBody(createSkillSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;
    const skill = await prisma.skill.create({
      data: {
        title: data.title,
        content: data.content,
        categories: data.categories,
        quickFacts: data.quickFacts,
        edgeCases: data.edgeCases,
        sourceUrls: data.sourceUrls,
        isActive: data.isActive,
        createdBy: auth.session.user.email || undefined,
        ownerId: auth.session.user.id,
        owners: data.owners,
        history: data.history || [
          {
            date: new Date().toISOString(),
            action: "created",
            summary: "Skill created",
            user: auth.session.user.email,
          },
        ],
      },
    });

    // Audit log with request context for IP/User-Agent tracking
    await logSkillChange(
      "CREATED",
      skill.id,
      skill.title,
      getUserFromSession(auth.session),
      undefined,
      { categories: data.categories },
      getRequestContext(request)
    );

    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    logger.error("Failed to create skill", error, { route: "/api/skills" });
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 }
    );
  }
}
