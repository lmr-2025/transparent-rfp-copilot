/**
 * Prompt System - Main Entry Point
 *
 * Centralized exports for the entire prompt system.
 * Import from here for backwards compatibility.
 *
 * @example
 * ```typescript
 * import { getDefaultPrompt, defaultBlocks } from '@/lib/prompt-system';
 * ```
 */

// Types and configuration
export * from "./types";

// Default definitions
export { defaultBlocks } from "./blocks";
export { defaultModifiers } from "./modifiers";
export { defaultCompositions } from "./compositions";

// Builder functions
export { buildPromptFromBlocks, getDefaultPrompt } from "./builder";
