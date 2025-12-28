/**
 * Prompt Composition Definitions
 *
 * Defines which blocks are used for each context and in what order.
 * Compositions can optionally support runtime modifiers (modes/domains).
 */

import type { PromptComposition } from "./types";

// ============================================
// DEFAULT COMPOSITIONS
// ============================================

export const defaultCompositions: PromptComposition[] = [
  {
    context: "questions",
    blockIds: ["role_mission", "source_priority", "quality_rules", "confidence_levels", "output_format"],
    supportsModes: true,
    supportsDomains: true,
  },
  {
    context: "skills",
    blockIds: ["role_mission", "quality_rules", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "analysis",
    blockIds: ["role_mission", "quality_rules", "error_handling", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "chat",
    blockIds: ["role_mission", "source_priority", "user_instructions", "error_handling", "output_format"],
    supportsModes: false,
    supportsDomains: true,
  },
  {
    context: "contracts",
    blockIds: ["role_mission", "quality_rules", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "skill_organize",
    blockIds: ["role_mission", "processing_guidelines", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "customer_profile",
    blockIds: ["role_mission", "processing_guidelines", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "prompt_optimize",
    blockIds: ["role_mission", "processing_guidelines", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "skill_analyze",
    blockIds: ["role_mission", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "skill_refresh",
    blockIds: ["role_mission", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "skill_analyze_rfp",
    blockIds: ["role_mission", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "instruction_builder",
    blockIds: ["role_mission", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "skill_planning",
    blockIds: ["role_mission", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "collateral_planning",
    blockIds: ["role_mission", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "source_url_analysis",
    blockIds: ["role_mission", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "group_coherence_analysis",
    blockIds: ["role_mission", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
];

