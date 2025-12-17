import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getModel } from "@/lib/config";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";

// GET - Fetch the system prompts without sending a message (for transparency on page load)
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    // Load prompts from the prompt blocks system
    const builderSystemPrompt = await loadSystemPrompt(
      "instruction_builder",
      FALLBACK_BUILDER_PROMPT
    );

    const chatSystemPrompt = await loadSystemPrompt(
      "chat",
      "You are a helpful assistant."
    );

    const model = getModel("quality");

    return apiSuccess({
      builderSystemPrompt,
      chatSystemPrompt,
      model,
    });
  } catch (error) {
    logger.error("Failed to fetch builder prompts", error, {
      route: "/api/instruction-presets/build",
    });
    return errors.internal("Failed to fetch prompts");
  }
}

// Fallback prompt in case the prompt blocks fail to load
const FALLBACK_BUILDER_PROMPT = `You are a prompt engineering expert helping users create effective instruction presets for an AI assistant.

Guide users through building a custom AI persona by asking about:
1. Role/persona - Who should the AI be?
2. Primary responsibilities - What should it do?
3. Knowledge domains - What should it know about?
4. Communication style - Tone, format, length preferences?
5. Boundaries - What should it NOT do?

Be conversational and helpful. Ask one or two questions at a time.
When you have enough information, generate a polished instruction preset.

When ready, output in this format:
---PRESET_READY---
Name: [short descriptive name]
Description: [1-2 sentence description]
Content:
[full instruction preset content - professional, clear, actionable]
---END_PRESET---`;

type Message = {
  role: "assistant" | "user";
  content: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { messages } = body as { messages: Message[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return errors.badRequest("Messages are required");
    }

    // Load the builder system prompt from the prompt blocks system
    const builderSystemPrompt = await loadSystemPrompt(
      "instruction_builder",
      FALLBACK_BUILDER_PROMPT
    );

    // Also load the chat system prompt to return for context
    const chatSystemPrompt = await loadSystemPrompt(
      "chat",
      "You are a helpful assistant."
    );

    // Convert to Anthropic message format
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const anthropic = new Anthropic();
    const model = getModel("quality"); // Use quality model for better results

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: builderSystemPrompt,
      messages: anthropicMessages,
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return apiSuccess({
      response: responseText,
      chatSystemPrompt, // Return the chat system prompt for context
      builderSystemPrompt, // Return the builder prompt for transparency
      model, // Return which model is being used
    });
  } catch (error) {
    logger.error("Failed to build instruction preset", error, {
      route: "/api/instruction-presets/build",
    });
    return errors.internal("Failed to generate response");
  }
}
