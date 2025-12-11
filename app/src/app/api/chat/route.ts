// Next.js API route for secure Claude API communication

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json();

    // Initialize Anthropic client with API key from environment
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: systemPrompt,
      messages: messages,
    });

    // Return response
    return NextResponse.json({
      content: response.content,
      usage: response.usage,
      id: response.id,
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to process request',
      },
      { status: 500 }
    );
  }
}
