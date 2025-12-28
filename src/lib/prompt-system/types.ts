/**
 * Prompt System Types and Configuration
 *
 * Core types and configuration for the prompt blocks system.
 * Prompts are composed from reusable building blocks with context-specific variants.
 *
 * TIER SYSTEM:
 * - Tier 1 (Locked): Core system blocks - should rarely be edited. Changes can break functionality.
 * - Tier 2 (Caution): Important blocks - can be customized but with care.
 * - Tier 3 (Open): Safe to customize freely - personalization and style.
 */

// The contexts where prompts are used
export type PromptContext =
  | "questions"            // Answering questionnaire/assessment questions
  | "skills"               // Building knowledge skills
  | "analysis"             // Analyzing documents/libraries
  | "chat"                 // Knowledge chat
  | "contracts"            // Contract analysis
  | "skill_organize"       // Organizing/merging skills from sources
  | "skill_analyze"        // Analyzing URLs/docs to decide skill actions (create/update)
  | "skill_refresh"        // Refreshing a skill from its source URLs
  | "skill_analyze_rfp"    // Analyzing RFP Q&A to extract skill knowledge
  | "skill_planning"       // Conversational planning for skill creation
  | "customer_profile"     // Extracting customer profiles
  | "prompt_optimize"      // Optimizing prompt sections
  | "instruction_builder"  // Building instruction presets for chat
  | "collateral_planning"  // Conversational planning for collateral generation
  | "source_url_analysis"  // Analyzing URL content vs existing skill for discrepancies
  | "group_coherence_analysis"; // Analyzing coherence of multiple sources within a group

// Editability tiers for blocks and modifiers
export type PromptTier = 1 | 2 | 3;

export const tierConfig: Record<PromptTier, {
  label: string;
  description: string;
  color: { bg: string; border: string; text: string };
  icon: string;
  warning?: string;
}> = {
  1: {
    label: "Locked",
    description: "Core system functionality - changes may break features",
    color: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
    icon: "🔒",
    warning: "This block controls critical system behavior. Only edit if you understand the implications.",
  },
  2: {
    label: "Caution",
    description: "Important for accuracy - customize carefully",
    color: { bg: "#fefce8", border: "#fde68a", text: "#ca8a04" },
    icon: "⚠️",
    warning: "Changes to this block may affect response quality or consistency.",
  },
  3: {
    label: "Open",
    description: "Safe to customize - style and personalization",
    color: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" },
    icon: "✏️",
  },
};

// A single building block that can have context-specific variants
export type PromptBlock = {
  id: string;
  name: string;
  description: string;
  tier: PromptTier;
  // "default" is used when no context-specific variant exists
  variants: Record<string, string> & { default: string };
};

// Which blocks are used for each context, in order
export type PromptComposition = {
  context: PromptContext;
  blockIds: string[];
  // Optional runtime additions (mode, domain)
  supportsModes?: boolean;
  supportsDomains?: boolean;
};

// Runtime modifiers (injected based on user selection)
export type PromptModifier = {
  id: string;
  name: string;
  type: "mode" | "domain";
  tier: PromptTier;
  content: string;
};
