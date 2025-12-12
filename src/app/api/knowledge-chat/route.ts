import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { EditableChatSection, buildChatPromptFromSections, defaultChatSections } from "@/lib/promptSections";
import { CLAUDE_MODEL } from "@/lib/config";

export const maxDuration = 60;

type SkillContext = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  message: string;
  skills: SkillContext[];
  conversationHistory?: ChatMessage[];
  chatSections?: EditableChatSection[];
};

type ChatResponse = {
  response: string;
  skillsUsed: { id: string; title: string }[];
  // Transparency data
  transparency: {
    systemPrompt: string;
    knowledgeContext: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
};

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const skills = Array.isArray(body?.skills) ? body.skills : [];
  const conversationHistory = Array.isArray(body?.conversationHistory) ? body.conversationHistory : [];
  const chatSections = Array.isArray(body?.chatSections) && body.chatSections.length > 0
    ? body.chatSections
    : defaultChatSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const anthropic = new Anthropic({ apiKey });

    // Build knowledge base context from skills
    const knowledgeContext = skills.length > 0
      ? skills.map((skill, idx) =>
          `=== KNOWLEDGE SOURCE ${idx + 1}: ${skill.title} ===\nTags: ${skill.tags.join(", ") || "none"}\n\n${skill.content}`
        ).join("\n\n---\n\n")
      : "No knowledge base documents provided.";

    // Build system prompt from configured sections
    const systemPrompt = buildChatPromptFromSections(chatSections, knowledgeContext);

    // Build messages array with conversation history
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format");
    }

    // Determine which skills were likely used (simple heuristic: check if skill title/tag is mentioned in response)
    const skillsUsed = skills
      .filter(skill =>
        content.text.toLowerCase().includes(skill.title.toLowerCase()) ||
        skill.tags.some(tag => content.text.toLowerCase().includes(tag.toLowerCase()))
      )
      .map(skill => ({ id: skill.id, title: skill.title }));

    const result: ChatResponse = {
      response: content.text,
      skillsUsed,
      transparency: {
        systemPrompt,
        knowledgeContext,
        model: CLAUDE_MODEL,
        maxTokens: 4000,
        temperature: 0.3,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Knowledge chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process chat request";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
