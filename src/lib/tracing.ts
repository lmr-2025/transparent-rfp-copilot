/**
 * LLM Tracing Library
 *
 * Captures every LLM call with full context for observability and feedback correlation.
 * Designed for OTEL export to Monte Carlo or other observability platforms.
 */

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import prisma from "./prisma";
import { logger } from "./logger";
import type { Prisma } from "@prisma/client";

export type TraceContext = {
  traceId: string;
  parentTraceId?: string;
  spanName: string;
  feature: "questions" | "chat" | "contracts" | "skills" | "projects";
  userId?: string;
  userEmail?: string;
};

export type TraceInput = {
  model: string;
  systemPrompt: string;
  userMessage: string;
  skills?: { id: string; title: string }[];
};

export type TraceOutput = {
  response: string;
  confidence?: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
};

export type EntityLink = {
  questionHistoryId?: string;
  bulkRowId?: string;
  chatSessionId?: string;
  contractFindingId?: string;
  skillId?: string;
};

/**
 * Generate a new trace ID (UUID v4)
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Create a hash of the prompt for deduplication/grouping
 */
export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

/**
 * Start a new trace context
 */
export function startTrace(
  spanName: string,
  feature: TraceContext["feature"],
  options?: {
    parentTraceId?: string;
    userId?: string;
    userEmail?: string;
  }
): TraceContext {
  return {
    traceId: generateTraceId(),
    parentTraceId: options?.parentTraceId,
    spanName,
    feature,
    userId: options?.userId,
    userEmail: options?.userEmail,
  };
}

/**
 * Record a completed LLM trace to the database
 */
export async function recordTrace(
  context: TraceContext,
  input: TraceInput,
  output: TraceOutput,
  latencyMs: number,
  entityLink?: EntityLink,
  options?: {
    savePromptSnapshot?: boolean; // Default false to save space
  }
): Promise<string> {
  try {
    const trace = await prisma.lLMTrace.create({
      data: {
        traceId: context.traceId,
        parentTraceId: context.parentTraceId,
        spanName: context.spanName,
        feature: context.feature,
        model: input.model,
        promptHash: hashPrompt(input.systemPrompt),
        promptSnapshot: options?.savePromptSnapshot ? input.systemPrompt : null,
        userMessage: input.userMessage,
        skillsProvided: input.skills as Prisma.InputJsonValue,
        response: output.response,
        confidence: output.confidence,
        inputTokens: output.inputTokens,
        outputTokens: output.outputTokens,
        latencyMs,
        cacheHit: (output.cacheReadTokens ?? 0) > 0,
        cacheCreationTokens: output.cacheCreationTokens,
        cacheReadTokens: output.cacheReadTokens,
        userId: context.userId,
        userEmail: context.userEmail,
        questionHistoryId: entityLink?.questionHistoryId,
        bulkRowId: entityLink?.bulkRowId,
        chatSessionId: entityLink?.chatSessionId,
        contractFindingId: entityLink?.contractFindingId,
        skillId: entityLink?.skillId,
      },
    });

    logger.info("LLM trace recorded", {
      traceId: context.traceId,
      spanName: context.spanName,
      feature: context.feature,
      latencyMs,
      inputTokens: output.inputTokens,
      outputTokens: output.outputTokens,
      cacheHit: (output.cacheReadTokens ?? 0) > 0,
    });

    return trace.traceId;
  } catch (error) {
    // Log but don't throw - tracing shouldn't break the main flow
    logger.error("Failed to record LLM trace", error, {
      traceId: context.traceId,
      spanName: context.spanName,
    });
    return context.traceId;
  }
}

/**
 * Update a trace with feedback after human review
 */
export async function attachFeedbackToTrace(
  traceId: string,
  feedback: {
    categories: string[];
    note?: string;
    wasEdited: boolean;
    editDelta?: string;
  }
): Promise<void> {
  try {
    await prisma.lLMTrace.update({
      where: { traceId },
      data: {
        feedbackCategories: feedback.categories as Prisma.InputJsonValue,
        feedbackNote: feedback.note,
        wasEdited: feedback.wasEdited,
        editDelta: feedback.editDelta,
      },
    });

    logger.info("Feedback attached to trace", {
      traceId,
      categories: feedback.categories,
      wasEdited: feedback.wasEdited,
    });
  } catch (error) {
    logger.error("Failed to attach feedback to trace", error, { traceId });
  }
}

/**
 * Find trace by entity ID (for attaching feedback later)
 */
export async function findTraceByEntity(
  entityType: keyof EntityLink,
  entityId: string
): Promise<string | null> {
  try {
    const trace = await prisma.lLMTrace.findFirst({
      where: { [entityType]: entityId },
      select: { traceId: true },
      orderBy: { createdAt: "desc" },
    });
    return trace?.traceId ?? null;
  } catch (error) {
    logger.error("Failed to find trace by entity", error, { entityType, entityId });
    return null;
  }
}

/**
 * High-level wrapper to trace an LLM call
 * Usage:
 *   const { result, traceId } = await withTracing(
 *     startTrace("answer_question", "questions", { userId }),
 *     { model, systemPrompt, userMessage, skills },
 *     async () => {
 *       // your actual LLM call here
 *       return await anthropic.messages.create(...);
 *     }
 *   );
 */
export async function withTracing<T extends { usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } }>(
  context: TraceContext,
  input: TraceInput,
  llmCall: () => Promise<T>,
  options?: {
    extractResponse: (result: T) => string;
    extractConfidence?: (result: T) => string | undefined;
    entityLink?: EntityLink;
    savePromptSnapshot?: boolean;
  }
): Promise<{ result: T; traceId: string }> {
  const startTime = Date.now();

  const result = await llmCall();

  const latencyMs = Date.now() - startTime;

  const output: TraceOutput = {
    response: options?.extractResponse?.(result) ?? "",
    confidence: options?.extractConfidence?.(result),
    inputTokens: result.usage?.input_tokens ?? 0,
    outputTokens: result.usage?.output_tokens ?? 0,
    cacheCreationTokens: result.usage?.cache_creation_input_tokens,
    cacheReadTokens: result.usage?.cache_read_input_tokens,
  };

  const traceId = await recordTrace(
    context,
    input,
    output,
    latencyMs,
    options?.entityLink,
    { savePromptSnapshot: options?.savePromptSnapshot }
  );

  return { result, traceId };
}
