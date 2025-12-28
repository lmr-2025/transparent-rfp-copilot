/**
 * Prompt Blocks System - Compatibility Layer
 *
 * This file maintains backwards compatibility with the old single-file system.
 * The implementation has been refactored into modular files in src/lib/prompt-system/
 *
 * NEW CODE: Import from '@/lib/prompt-system' instead:
 * @example
 * ```typescript
 * import { getDefaultPrompt, defaultBlocks } from '@/lib/prompt-system';
 * ```
 *
 * This file can be removed once all imports are migrated.
 */

// Re-export everything from the new modular system
export * from "./prompt-system";
