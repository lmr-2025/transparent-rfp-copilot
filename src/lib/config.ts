// Centralized configuration for the application

// Claude models for LLM calls
// Sonnet: Best quality, slower (~10-30s) - use for complex analysis, RFP answering
// Haiku: Fast and cheap (~2-5s) - use for quick Q&A, simple tasks
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
export const CLAUDE_MODEL_FAST = process.env.CLAUDE_MODEL_FAST || "claude-3-5-haiku-20241022";

// Model selection helper
export type ModelSpeed = "fast" | "quality";

export function getModel(speed: ModelSpeed = "quality"): string {
  return speed === "fast" ? CLAUDE_MODEL_FAST : CLAUDE_MODEL;
}

// LLM Feature identifiers - used for speed defaults and preferences
export type LLMFeature =
  | "chat"              // Knowledge chat / The Oracle
  | "questions"         // Quick questions on home page
  | "questions-batch"   // Bulk RFP question processing
  | "skills-suggest"    // Skill generation/update
  | "skills-analyze"    // Analyze URLs for skill routing
  | "skills-analyze-rfp"    // Analyze RFP for skill suggestions
  | "skills-analyze-library" // Library health analysis
  | "skills-refresh"    // Refresh skill from sources
  | "customers-analyze" // Analyze URLs for customer matching
  | "customers-suggest" // Generate customer profiles
  | "customers-build"   // Build profile from documents
  | "contracts-analyze" // Contract clause analysis
  | "prompts-optimize"  // Prompt optimization suggestions
  | "documents-template"; // Generate document templates

// System defaults for LLM speed per feature
export const LLM_SPEED_DEFAULTS: Record<LLMFeature, ModelSpeed> = {
  "chat": "quality",
  "questions": "quality",
  "questions-batch": "quality",
  "skills-suggest": "quality",
  "skills-analyze": "quality",
  "skills-analyze-rfp": "quality",
  "skills-analyze-library": "quality",
  "skills-refresh": "quality",
  "customers-analyze": "quality",
  "customers-suggest": "quality",
  "customers-build": "quality",
  "contracts-analyze": "quality",
  "prompts-optimize": "quality",
  "documents-template": "quality",
};

// Get effective speed for a feature, considering user override and request override
export function getEffectiveSpeed(
  feature: LLMFeature,
  requestOverride?: boolean,  // quickMode from request body
  userOverrides?: Record<string, ModelSpeed> | null,  // from user preferences
): ModelSpeed {
  // Request-level override takes highest priority (UI toggle)
  if (requestOverride === true) return "fast";
  if (requestOverride === false) return "quality";

  // User preference override
  if (userOverrides && userOverrides[feature]) {
    return userOverrides[feature];
  }

  // System default
  return LLM_SPEED_DEFAULTS[feature];
}
