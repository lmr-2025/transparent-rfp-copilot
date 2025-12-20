/**
 * Token estimation utilities for LLM context management.
 * Uses rough approximations suitable for UI display - not exact tokenization.
 */

/**
 * Estimate token count from text.
 * Uses ~4 characters per token as a rough approximation for English text.
 * This is intentionally conservative to avoid underestimating.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Format token count for display.
 * Shows "12.5k" for large numbers, raw number for small.
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Calculate token usage percentage and status.
 */
export function getTokenUsageStatus(
  usedTokens: number,
  maxTokens: number
): {
  usagePercent: number;
  isHigh: boolean;
  isCritical: boolean;
} {
  const usagePercent = Math.min(100, Math.round((usedTokens / maxTokens) * 100));
  return {
    usagePercent,
    isHigh: usagePercent > 70,
    isCritical: usagePercent > 90,
  };
}

/**
 * Default token limits for different contexts.
 */
export const TOKEN_LIMITS = {
  /** Practical limit for chat conversations */
  CHAT_MAX: 100000,
  /** Threshold for showing compact button (history tokens) */
  COMPACT_THRESHOLD: 5000,
  /** Estimate per document when content not loaded */
  DOC_ESTIMATE: 2000,
  /** Estimate per customer profile */
  CUSTOMER_ESTIMATE: 500,
  /** Base system prompt estimate */
  SYSTEM_PROMPT_BASE: 500,
} as const;
