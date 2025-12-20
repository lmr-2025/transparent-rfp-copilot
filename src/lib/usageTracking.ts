import prisma from "./prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

// Claude API pricing (per 1M tokens) as of Dec 2024
// https://www.anthropic.com/pricing
const PRICING = {
  "claude-sonnet-4-20250514": {
    input: 3.0, // $3 per 1M input tokens
    output: 15.0, // $15 per 1M output tokens
  },
  "claude-3-5-sonnet-20241022": {
    input: 3.0,
    output: 15.0,
  },
  "claude-3-opus-20240229": {
    input: 15.0,
    output: 75.0,
  },
  "claude-3-haiku-20240307": {
    input: 0.25,
    output: 1.25,
  },
  // Default fallback for unknown models
  default: {
    input: 3.0,
    output: 15.0,
  },
} as const;

type ModelKey = keyof typeof PRICING;

export interface UsageData {
  userId?: string | null;
  userEmail?: string | null;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Tokens written to Anthropic prompt cache (1.25x cost) */
  cacheCreationTokens?: number;
  /** Tokens read from Anthropic prompt cache (0.1x cost - 90% savings!) */
  cacheReadTokens?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Calculate the estimated cost for a given usage.
 * Accounts for prompt caching pricing:
 * - Cache writes cost 1.25x base input price
 * - Cache reads cost 0.1x base input price (90% savings!)
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens?: number,
  cacheReadTokens?: number
): number {
  const pricing = PRICING[model as ModelKey] || PRICING.default;

  // Base input cost (non-cached tokens)
  const nonCachedInputTokens = inputTokens - (cacheCreationTokens || 0) - (cacheReadTokens || 0);
  const baseCost = (Math.max(0, nonCachedInputTokens) / 1_000_000) * pricing.input;

  // Cache write cost (1.25x base price)
  const cacheWriteCost = ((cacheCreationTokens || 0) / 1_000_000) * pricing.input * 1.25;

  // Cache read cost (0.1x base price - 90% discount!)
  const cacheReadCost = ((cacheReadTokens || 0) / 1_000_000) * pricing.input * 0.1;

  // Output cost (unchanged)
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return baseCost + cacheWriteCost + cacheReadCost + outputCost;
}

/**
 * Log API usage to the database
 */
export async function logUsage(data: UsageData): Promise<void> {
  try {
    const totalTokens = data.inputTokens + data.outputTokens;
    const estimatedCost = calculateCost(
      data.model,
      data.inputTokens,
      data.outputTokens,
      data.cacheCreationTokens,
      data.cacheReadTokens
    );

    // Include cache metrics in metadata for analysis
    const metadata = {
      ...data.metadata,
      ...(data.cacheCreationTokens !== undefined && { cacheCreationTokens: data.cacheCreationTokens }),
      ...(data.cacheReadTokens !== undefined && { cacheReadTokens: data.cacheReadTokens }),
    };

    await prisma.apiUsage.create({
      data: {
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        feature: data.feature,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens,
        estimatedCost,
        metadata: Object.keys(metadata).length > 0 ? metadata as Prisma.InputJsonValue : undefined,
      },
    });
  } catch (error) {
    // Log but don't throw - we don't want usage tracking to break the main flow
    logger.error("Failed to log API usage", error, { feature: data.feature, model: data.model });
  }
}

/**
 * Extract token usage from Anthropic API response, including cache metrics.
 */
export function extractUsageFromResponse(response: {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}): {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
} {
  const result: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  } = {
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  };

  // Only include cache metrics if they're present (indicates caching was used)
  if (response.usage?.cache_creation_input_tokens !== undefined) {
    result.cacheCreationTokens = response.usage.cache_creation_input_tokens;
  }
  if (response.usage?.cache_read_input_tokens !== undefined) {
    result.cacheReadTokens = response.usage.cache_read_input_tokens;
  }

  return result;
}

/**
 * Get usage summary for a user within a date range
 */
export async function getUserUsageSummary(
  userId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: {
    userId: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { userId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const usage = await prisma.apiUsage.aggregate({
    where,
    _sum: {
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      estimatedCost: true,
    },
    _count: true,
  });

  return {
    totalInputTokens: usage._sum.inputTokens || 0,
    totalOutputTokens: usage._sum.outputTokens || 0,
    totalTokens: usage._sum.totalTokens || 0,
    totalCost: usage._sum.estimatedCost || 0,
    callCount: usage._count,
  };
}

/**
 * Get usage breakdown by feature
 */
export async function getUsageByFeature(
  userId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: {
    userId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const usage = await prisma.apiUsage.groupBy({
    by: ["feature"],
    where,
    _sum: {
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      estimatedCost: true,
    },
    _count: true,
  });

  return usage.map((item) => ({
    feature: item.feature,
    inputTokens: item._sum.inputTokens || 0,
    outputTokens: item._sum.outputTokens || 0,
    totalTokens: item._sum.totalTokens || 0,
    totalCost: item._sum.estimatedCost || 0,
    callCount: item._count,
  }));
}

/**
 * Get daily usage for charts
 */
export async function getDailyUsage(
  userId?: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const where: {
    userId?: string;
    createdAt: { gte: Date };
  } = {
    createdAt: { gte: startDate },
  };

  if (userId) where.userId = userId;

  const usage = await prisma.apiUsage.findMany({
    where,
    select: {
      createdAt: true,
      totalTokens: true,
      estimatedCost: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by date
  const dailyMap = new Map<string, { tokens: number; cost: number; calls: number }>();

  for (const item of usage) {
    const dateKey = item.createdAt.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || { tokens: 0, cost: 0, calls: 0 };
    existing.tokens += item.totalTokens;
    existing.cost += item.estimatedCost;
    existing.calls += 1;
    dailyMap.set(dateKey, existing);
  }

  // Fill in missing days
  const result: Array<{ date: string; tokens: number; cost: number; calls: number }> = [];
  const current = new Date(startDate);
  const today = new Date();

  while (current <= today) {
    const dateKey = current.toISOString().split("T")[0];
    const data = dailyMap.get(dateKey) || { tokens: 0, cost: 0, calls: 0 };
    result.push({ date: dateKey, ...data });
    current.setDate(current.getDate() + 1);
  }

  return result;
}
