/**
 * Prompt Builder Functions
 *
 * Functions for building complete prompts from blocks, compositions, and modifiers.
 */

import type { PromptBlock, PromptComposition, PromptModifier, PromptContext } from "./types";
import { defaultBlocks } from "./blocks";
import { defaultModifiers } from "./modifiers";
import { defaultCompositions } from "./compositions";

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build a prompt string from blocks for a given context
 */
export function buildPromptFromBlocks(
  blocks: PromptBlock[],
  composition: PromptComposition,
  options?: {
    mode?: "single" | "bulk";
    domains?: Array<"technical" | "legal" | "security">;
    modifiers?: PromptModifier[];
  }
): string {
  const parts: string[] = [];

  // Add blocks in order
  for (const blockId of composition.blockIds) {
    const block = blocks.find(b => b.id === blockId);
    if (!block) continue;

    // Use context-specific variant if available, otherwise default
    const content = block.variants[composition.context] ?? block.variants.default;
    if (content.trim()) {
      parts.push(`## ${block.name}\n${content}`);
    }
  }

  // Add mode modifier if applicable
  if (composition.supportsModes && options?.mode && options?.modifiers) {
    const modeModifier = options.modifiers.find(m => m.id === `mode_${options.mode}`);
    if (modeModifier) {
      parts.push(`## ${modeModifier.name}\n${modeModifier.content}`);
    }
  }

  // Add domain modifiers if applicable
  if (composition.supportsDomains && options?.domains && options?.modifiers) {
    for (const domain of options.domains) {
      const domainModifier = options.modifiers.find(m => m.id === `domain_${domain}`);
      if (domainModifier) {
        parts.push(`## ${domainModifier.name}\n${domainModifier.content}`);
      }
    }
  }

  return parts.join("\n\n");
}

/**
 * Get the prompt for a specific context with default blocks
 */
export function getDefaultPrompt(
  context: PromptContext,
  options?: {
    mode?: "single" | "bulk";
    domains?: Array<"technical" | "legal" | "security">;
  }
): string {
  const composition = defaultCompositions.find(c => c.context === context);
  if (!composition) {
    return "You are a helpful assistant.";
  }

  return buildPromptFromBlocks(defaultBlocks, composition, {
    ...options,
    modifiers: defaultModifiers,
  });
}
