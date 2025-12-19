import { prisma } from "./prisma";

/**
 * Review modes available in the system
 * - none: No reviews, direct save (default during building phase)
 * - self: Self-review required (draft → review → publish)
 * - team: Team review required (submit → approval → publish)
 */
export type ReviewMode = "none" | "self" | "team";

/**
 * Get the global review mode setting
 * Defaults to 'none' (reviews disabled)
 * @returns Current review mode
 */
export async function getReviewMode(): Promise<ReviewMode> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "review_mode" },
    });

    if (!setting) {
      return "none"; // Default: reviews disabled
    }

    const mode = setting.value as ReviewMode;
    if (mode === "none" || mode === "self" || mode === "team") {
      return mode;
    }

    return "none"; // Invalid value, fallback to default
  } catch (error) {
    console.error("Error fetching review mode:", error);
    return "none"; // Fallback to default on error
  }
}

/**
 * Set the global review mode
 * @param mode - The review mode to set
 */
export async function setReviewMode(mode: ReviewMode): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: "review_mode" },
    create: {
      key: "review_mode",
      value: mode,
      description: "Global review mode: none (disabled), self (self-review), or team (team review)",
      isSecret: false,
    },
    update: {
      value: mode,
      updatedAt: new Date(),
    },
  });
}

/**
 * Check if a specific skill requires review
 * Takes into account:
 * 1. Skill-level requiresReview setting (if set)
 * 2. Category-level requiresReview setting (if skill setting is null)
 * 3. Global review mode (if both are null)
 *
 * @param skillId - The skill ID to check
 * @returns True if review is required
 */
export async function getSkillRequiresReview(skillId: string): Promise<boolean> {
  try {
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: {
        requiresReview: true,
        categories: true,
      },
    });

    if (!skill) {
      return false; // Skill not found, default to no review
    }

    // Check skill-level setting first
    if (skill.requiresReview !== null) {
      return skill.requiresReview;
    }

    // Check category-level settings
    if (skill.categories && skill.categories.length > 0) {
      const categories = await prisma.skillCategory.findMany({
        where: {
          name: { in: skill.categories },
        },
        select: {
          requiresReview: true,
        },
      });

      // If ANY category requires review, the skill requires review
      const categoryRequiresReview = categories.some(
        (cat) => cat.requiresReview === true
      );

      if (categoryRequiresReview) {
        return true;
      }
    }

    // Fall back to global review mode
    const mode = await getReviewMode();
    return mode !== "none";
  } catch (error) {
    console.error("Error checking skill review requirement:", error);
    return false; // Fallback to no review on error
  }
}

/**
 * Get minimum number of approvers required for a skill
 * @param skillId - The skill ID
 * @returns Minimum number of approvers (default: 1)
 */
export async function getSkillMinApprovers(skillId: string): Promise<number> {
  try {
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: {
        minApprovers: true,
        categories: true,
      },
    });

    if (!skill) {
      return 1; // Default
    }

    // Check skill-level setting first
    if (skill.minApprovers !== null) {
      return skill.minApprovers;
    }

    // Check category-level settings
    if (skill.categories && skill.categories.length > 0) {
      const categories = await prisma.skillCategory.findMany({
        where: {
          name: { in: skill.categories },
        },
        select: {
          minApprovers: true,
        },
      });

      // Use the maximum minApprovers from all categories
      const maxApprovers = Math.max(
        ...categories
          .map((cat) => cat.minApprovers)
          .filter((val): val is number => val !== null),
        1
      );

      return maxApprovers;
    }

    return 1; // Default
  } catch (error) {
    console.error("Error fetching skill min approvers:", error);
    return 1;
  }
}

/**
 * Get list of allowed approvers for a skill
 * @param skillId - The skill ID
 * @returns Array of approver email addresses or user IDs
 */
export async function getSkillApprovers(skillId: string): Promise<string[]> {
  try {
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: {
        approvers: true,
        categories: true,
      },
    });

    if (!skill) {
      return [];
    }

    // Check skill-level setting first
    if (skill.approvers && skill.approvers.length > 0) {
      return skill.approvers;
    }

    // Check category-level settings
    if (skill.categories && skill.categories.length > 0) {
      const categories = await prisma.skillCategory.findMany({
        where: {
          name: { in: skill.categories },
        },
        select: {
          approvers: true,
        },
      });

      // Combine approvers from all categories (deduplicate)
      const allApprovers = new Set<string>();
      categories.forEach((cat) => {
        cat.approvers.forEach((approver) => allApprovers.add(approver));
      });

      return Array.from(allApprovers);
    }

    return []; // No specific approvers, anyone can approve
  } catch (error) {
    console.error("Error fetching skill approvers:", error);
    return [];
  }
}

/**
 * Helper to determine the initial status for a new skill
 * Based on review mode and requirements
 * @param categories - Skill categories
 * @returns Initial skill status
 */
export async function getInitialSkillStatus(
  categories: string[]
): Promise<"DRAFT" | "PUBLISHED"> {
  const mode = await getReviewMode();

  if (mode === "none") {
    return "PUBLISHED"; // Reviews disabled, publish immediately
  }

  // Check if any category requires review
  if (categories && categories.length > 0) {
    const categorySettings = await prisma.skillCategory.findMany({
      where: {
        name: { in: categories },
      },
      select: {
        requiresReview: true,
      },
    });

    const requiresReview = categorySettings.some(
      (cat) => cat.requiresReview === true
    );

    if (requiresReview) {
      return "DRAFT"; // Category requires review
    }
  }

  // If mode is 'self' or 'team', start as draft
  if (mode === "self" || mode === "team") {
    return "DRAFT";
  }

  return "PUBLISHED"; // Default to published
}
