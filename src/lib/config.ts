// Centralized configuration for the application

// Claude model to use for all LLM calls
// Override via CLAUDE_MODEL env var if needed (e.g., when Anthropic rotates model IDs)
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
