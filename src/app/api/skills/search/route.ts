import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { selectRelevantSkills } from "@/lib/questionHelpers";
import type { Skill, SkillTier } from "@/types/skill";
import { z } from "zod";

/**
 * POST /api/skills/search - Search for relevant skills across specified tiers
 *
 * @description Searches for skills using keyword-based relevance scoring.
 * Filters by tier and optionally by categories. Designed for progressive
 * skill loading (Tier 2/3 retrieval when Tier 1 can't answer).
 *
 * @authentication Required - returns 401 if not authenticated
 *
 * @body {string} query - The question/search query
 * @body {string[]} [categories] - Restrict to these categories (empty = all)
 * @body {SkillTier[]} tiers - Which tiers to search ["extended", "library"]
 * @body {number} [limit=5] - Max skills to return (default 5, max 20)
 * @body {string[]} [excludeIds] - Don't return these IDs (already loaded)
 *
 * @returns {{ skills: Skill[], searchMethod: string }} 200 - Matching skills
 * @returns {{ error: string }} 400 - Validation error
 * @returns {{ error: string }} 401 - Unauthorized
 * @returns {{ error: string }} 500 - Server error
 *
 * @example
 * POST /api/skills/search
 * {
 *   "query": "How do we handle SSO authentication?",
 *   "categories": ["Security & Compliance"],
 *   "tiers": ["extended"],
 *   "limit": 5,
 *   "excludeIds": ["uuid1", "uuid2"]
 * }
 */

const searchSchema = z.object({
  query: z.string().min(1, "Query is required").max(10000),
  categories: z.array(z.string()).optional(),
  tiers: z.array(z.enum(["core", "extended", "library"])).min(1, "At least one tier required"),
  limit: z.number().int().min(1).max(20).default(5),
  excludeIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();

    // Validate request body
    const result = searchSchema.safeParse(body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return errors.validation(
        firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid input"
      );
    }

    const { query, categories, tiers, limit, excludeIds } = result.data;

    // Build where clause for tier + category filtering
    const where: {
      isActive: boolean;
      tier: { in: SkillTier[] };
      categories?: { hasSome: string[] };
      id?: { notIn: string[] };
    } = {
      isActive: true,
      tier: { in: tiers },
    };

    // Filter by categories if provided and not empty
    if (categories && categories.length > 0) {
      where.categories = { hasSome: categories };
    }

    // Exclude already-loaded skills
    if (excludeIds && excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    // Fetch candidate skills from database
    const candidateSkills = await prisma.skill.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      // Fetch more than needed to allow for scoring/filtering
      take: Math.min(limit * 5, 100),
    });

    // Score and rank using keyword matching
    const scoredSkills = selectRelevantSkills(
      query,
      candidateSkills as unknown as Skill[]
    );

    // Return top N skills
    const topSkills = scoredSkills.slice(0, limit);

    logger.info("Skills search completed", {
      query,
      tiers,
      categories,
      candidatesFound: candidateSkills.length,
      resultsReturned: topSkills.length,
    });

    return apiSuccess({
      skills: topSkills,
      searchMethod: "keyword", // Future: "embedding" when implemented
    });
  } catch (error) {
    logger.error("Failed to search skills", error, { route: "/api/skills/search" });
    return errors.internal("Failed to search skills");
  }
}
