/**
 * Chat API Route - Secure Claude API communication
 *
 * This is the main chat endpoint for direct Claude conversations.
 * For knowledge-based chat, use /api/knowledge-chat instead.
 *
 * @module /api/chat
 */

import { NextRequest } from 'next/server';
import { CLAUDE_MODEL } from '@/lib/config';
import { simpleChatSchema, validateBody } from '@/lib/validations';
import { getAnthropicClient } from '@/lib/apiHelpers';
import { requireAuth } from '@/lib/apiAuth';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

/**
 * POST /api/chat - Send messages to Claude
 *
 * @description Forwards a conversation to Claude API and returns the response.
 * This is a rate-limited endpoint (10 requests/minute) to prevent abuse.
 *
 * @authentication Required - returns 401 if not authenticated
 * @rateLimit 10 requests per minute (LLM tier)
 *
 * @body {Message[]} messages - Array of conversation messages
 * @body {string} messages[].role - "user" or "assistant"
 * @body {string} messages[].content - Message content
 * @body {string} [systemPrompt] - Optional system prompt to prepend
 *
 * @returns {{ content: ContentBlock[], usage: Usage, id: string }} 200 - Claude response
 * @returns {{ error: string }} 400 - Validation error
 * @returns {{ error: string }} 401 - Unauthorized
 * @returns {{ error: string }} 429 - Rate limit exceeded
 * @returns {{ error: string }} 500 - Server error
 *
 * @example
 * POST /api/chat
 * {
 *   "messages": [{"role": "user", "content": "What is SOC2?"}],
 *   "systemPrompt": "You are a compliance expert."
 * }
 */
export async function POST(req: NextRequest) {
  // Require authentication - this route gives access to Claude API
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(req);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  try {
    const body = await req.json();

    const validation = validateBody(simpleChatSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { messages, systemPrompt } = validation.data;

    const anthropic = getAnthropicClient();

    // Call Claude API
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system: systemPrompt || '',
      messages: messages as Anthropic.MessageParam[],
    });

    // Return response
    return apiSuccess({
      content: response.content,
      usage: response.usage,
      id: response.id,
    });

  } catch (error) {
    logger.error('Chat API failed', error, { route: '/api/chat' });
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return errors.internal(message);
  }
}
