// Next.js API route for secure Claude API communication

import { NextRequest, NextResponse } from 'next/server';
import { CLAUDE_MODEL } from '@/lib/config';
import { simpleChatSchema, validateBody } from '@/lib/validations';
import { getAnthropicClient } from '@/lib/apiHelpers';
import { requireAuth } from '@/lib/apiAuth';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

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
      return NextResponse.json({ error: validation.error }, { status: 400 });
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
    return NextResponse.json({
      content: response.content,
      usage: response.usage,
      id: response.id,
    });

  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
