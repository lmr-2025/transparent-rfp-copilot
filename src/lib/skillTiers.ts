import type { Skill, SkillTier } from "@/types/skill";

/**
 * Get the effective tier for a skill in a specific category context.
 *
 * This resolves the tier by checking category-specific overrides first,
 * then falling back to the skill's default tier.
 *
 * @param skill - The skill to check
 * @param selectedCategory - The category context (optional)
 * @returns The effective tier for this skill in the given category
 *
 * @example
 * // Skill with default tier "library" but "core" for Security
 * const skill = {
 *   tier: "library",
 *   tierOverrides: { "Security & Compliance": "core" }
 * };
 *
 * getTierForCategory(skill, "Security & Compliance") // "core"
 * getTierForCategory(skill, "Sales Enablement")      // "library"
 * getTierForCategory(skill)                          // "library"
 */
export function getTierForCategory(
  skill: Skill,
  selectedCategory?: string
): SkillTier {
  // No category context or no overrides = use default tier
  if (!selectedCategory || !skill.tierOverrides) {
    return skill.tier;
  }

  // Check for category-specific override
  const override = skill.tierOverrides[selectedCategory];
  return override || skill.tier;
}
