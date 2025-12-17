/**
 * Capabilities System
 *
 * Granular permission system that replaces the legacy role-based access.
 * Capabilities are computed from SSO groups + manual overrides on each login.
 */

import { Capability } from "@prisma/client";

// Re-export for convenience
export { Capability };

/**
 * Capability descriptions for UI display
 */
export const capabilityInfo: Record<Capability, { label: string; description: string }> = {
  ASK_QUESTIONS: {
    label: "Ask Questions",
    description: "Use quick questions, chat, and view own question history",
  },
  CREATE_PROJECTS: {
    label: "Create Projects",
    description: "Create and manage bulk projects, upload documents",
  },
  REVIEW_ANSWERS: {
    label: "Review Answers",
    description: "Verify, correct, and flag/resolve answers",
  },
  MANAGE_KNOWLEDGE: {
    label: "Manage Knowledge",
    description: "Create and edit skills, documents, and reference URLs",
  },
  MANAGE_PROMPTS: {
    label: "Manage Prompts",
    description: "Edit system prompts in the prompt builder",
  },
  VIEW_ORG_DATA: {
    label: "View Org Data",
    description: "See org-wide question log and accuracy metrics",
  },
  MANAGE_USERS: {
    label: "Manage Users",
    description: "Assign capabilities and manage SSO group mappings",
  },
  ADMIN: {
    label: "Admin",
    description: "Full access including system settings and destructive actions",
  },
};

/**
 * Default SSO group mappings (used as seed data)
 * These are the recommended tt-* group names
 */
export const defaultGroupMappings: {
  groupId: string;
  groupName: string;
  capabilities: Capability[];
}[] = [
  {
    groupId: "tt-users",
    groupName: "Copilot Users",
    capabilities: ["ASK_QUESTIONS", "CREATE_PROJECTS"],
  },
  {
    groupId: "tt-reviewers",
    groupName: "Copilot Reviewers",
    capabilities: ["ASK_QUESTIONS", "CREATE_PROJECTS", "REVIEW_ANSWERS", "VIEW_ORG_DATA"],
  },
  {
    groupId: "tt-knowledge-admins",
    groupName: "Knowledge Admins",
    capabilities: ["ASK_QUESTIONS", "CREATE_PROJECTS", "REVIEW_ANSWERS", "VIEW_ORG_DATA", "MANAGE_KNOWLEDGE"],
  },
  {
    groupId: "tt-prompt-admins",
    groupName: "Prompt Admins",
    capabilities: ["ASK_QUESTIONS", "CREATE_PROJECTS", "MANAGE_PROMPTS"],
  },
  {
    groupId: "tt-admins",
    groupName: "Copilot Admins",
    capabilities: [
      "ASK_QUESTIONS",
      "CREATE_PROJECTS",
      "REVIEW_ANSWERS",
      "MANAGE_KNOWLEDGE",
      "MANAGE_PROMPTS",
      "VIEW_ORG_DATA",
      "MANAGE_USERS",
      "ADMIN",
    ],
  },
];

/**
 * Check if a user has a specific capability
 */
export function hasCapability(
  userCapabilities: Capability[] | undefined | null,
  required: Capability
): boolean {
  if (!userCapabilities) return false;
  // ADMIN capability grants everything
  if (userCapabilities.includes("ADMIN")) return true;
  return userCapabilities.includes(required);
}

/**
 * Check if a user has ANY of the specified capabilities
 */
export function hasAnyCapability(
  userCapabilities: Capability[] | undefined | null,
  required: Capability[]
): boolean {
  if (!userCapabilities) return false;
  if (userCapabilities.includes("ADMIN")) return true;
  return required.some((cap) => userCapabilities.includes(cap));
}

/**
 * Check if a user has ALL of the specified capabilities
 */
export function hasAllCapabilities(
  userCapabilities: Capability[] | undefined | null,
  required: Capability[]
): boolean {
  if (!userCapabilities) return false;
  if (userCapabilities.includes("ADMIN")) return true;
  return required.every((cap) => userCapabilities.includes(cap));
}

/**
 * Merge capabilities from multiple sources (SSO groups + manual)
 * Removes duplicates
 */
export function mergeCapabilities(...capabilityArrays: (Capability[] | undefined | null)[]): Capability[] {
  const merged = new Set<Capability>();
  for (const arr of capabilityArrays) {
    if (arr) {
      for (const cap of arr) {
        merged.add(cap);
      }
    }
  }
  return Array.from(merged);
}

/**
 * Map legacy UserRole to capabilities (for migration)
 */
export function roleToCapabilities(role: string): Capability[] {
  switch (role) {
    case "ADMIN":
      return [
        "ASK_QUESTIONS",
        "CREATE_PROJECTS",
        "REVIEW_ANSWERS",
        "MANAGE_KNOWLEDGE",
        "MANAGE_PROMPTS",
        "VIEW_ORG_DATA",
        "MANAGE_USERS",
        "ADMIN",
      ];
    case "PROMPT_ADMIN":
      return ["ASK_QUESTIONS", "CREATE_PROJECTS", "MANAGE_PROMPTS"];
    case "USER":
    default:
      return ["ASK_QUESTIONS"];
  }
}

/**
 * Get the default capabilities for a new user with no SSO group matches
 */
export function getDefaultCapabilities(): Capability[] {
  return ["ASK_QUESTIONS"];
}

/**
 * Type guard to check if a string is a valid Capability
 */
export function isValidCapability(value: string): value is Capability {
  return Object.keys(capabilityInfo).includes(value as Capability);
}

/**
 * Sort capabilities in a consistent order for display
 */
const capabilityOrder: Capability[] = [
  "ASK_QUESTIONS",
  "CREATE_PROJECTS",
  "REVIEW_ANSWERS",
  "MANAGE_KNOWLEDGE",
  "MANAGE_PROMPTS",
  "VIEW_ORG_DATA",
  "MANAGE_USERS",
  "ADMIN",
];

export function sortCapabilities(capabilities: Capability[]): Capability[] {
  return [...capabilities].sort((a, b) => {
    return capabilityOrder.indexOf(a) - capabilityOrder.indexOf(b);
  });
}
