import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getModel } from "@/lib/config";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";

export const maxDuration = 60;

type Message = {
  role: "assistant" | "user";
  content: string;
};

type BuildTemplateRequest = {
  message: string;
  conversationHistory: Message[];
  systemPrompt: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  try {
    const body: BuildTemplateRequest = await request.json();
    const { message, conversationHistory, systemPrompt } = body;

    if (!message?.trim()) {
      return errors.badRequest("Message is required");
    }

    const anthropic = new Anthropic();

    // Build messages array
    const messages: Anthropic.MessageParam[] = [];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Generate response
    const response = await anthropic.messages.create({
      model: getModel(),
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    logger.info("Template build response generated", {
      route: "/api/templates/build",
    });

    return apiSuccess({ response: responseText });
  } catch (error) {
    logger.error("Failed to process template building", {
      route: "/api/templates/build",
      error: error instanceof Error ? error.message : String(error),
    });
    return errors.internal("Failed to process template building");
  }
}
