// Next.js API route for secure Claude API communication

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

type ChatRequestBody = {
  messages?: Array<{ role: string; content: string }>;
  systemPrompt?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestBody = await req.json();
    const { messages, systemPrompt } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    // Check API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'API not configured' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client with API key from environment
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
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
