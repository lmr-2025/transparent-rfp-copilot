import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getModel } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";

export const maxDuration = 60; // 1 minute for prompt building

const PROMPT_BUILDER_SYSTEM = `You are a prompt engineering expert helping users refine and improve prompts for AI systems.

Your role is to:
1. Analyze existing prompt content for clarity, effectiveness, and best practices
2. Suggest improvements while preserving the user's intent
3. Help users think through edge cases and potential issues
4. Provide concrete, actionable suggestions

When analyzing or improving a prompt, consider:
- Clarity: Is the instruction clear and unambiguous?
- Completeness: Are there missing details or edge cases?
- Structure: Is the prompt well-organized?
- Tone: Does the tone match the intended use case?
- Constraints: Are there appropriate guardrails?

Be conversational and helpful. Ask clarifying questions when needed.

When you have a refined version ready, output it in this format:
---PROMPT_READY---
[The improved prompt content]
---END_PROMPT---

If the user asks for analysis without wanting changes, just provide feedback without the PROMPT_READY markers.`;

type Message = {
  role: "assistant" | "user";
  content: string;
};

// GET - Fetch the system prompt for transparency
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const model = getModel("quality");
    return apiSuccess({
      systemPrompt: PROMPT_BUILDER_SYSTEM,
      model,
    });
  } catch (error) {
    logger.error("Failed to fetch builder prompts", error, {
      route: "/api/prompts/build",
    });
    return errors.internal("Failed to fetch prompts");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { messages, currentPrompt, blockName, context } = body as {
      messages: Message[];
      currentPrompt?: string;
      blockName?: string;
      context?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return errors.badRequest("Messages are required");
    }

    // Build context-aware system prompt
    let systemPrompt = PROMPT_BUILDER_SYSTEM;

    if (currentPrompt || blockName || context) {
      systemPrompt += "\n\n--- CURRENT CONTEXT ---";
      if (blockName) {
        systemPrompt += `\nBlock being edited: ${blockName}`;
      }
      if (context) {
        systemPrompt += `\nPrompt context: ${context}`;
      }
      if (currentPrompt) {
        systemPrompt += `\n\nCurrent prompt content:\n${currentPrompt}`;
      }
      systemPrompt += "\n--- END CONTEXT ---";
    }

    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const anthropic = new Anthropic();
    const model = getModel("quality");

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    // Log usage
    logUsage({
      userId: auth.session?.user?.id,
      userEmail: auth.session?.user?.email,
      feature: "prompt-build",
      model,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      metadata: { blockName, context },
    });

    return apiSuccess({
      response: responseText,
      systemPrompt, // Return for transparency
      model,
    });
  } catch (error) {
    logger.error("Failed to build prompt", error, {
      route: "/api/prompts/build",
    });
    return errors.internal("Failed to generate response");
  }
}
