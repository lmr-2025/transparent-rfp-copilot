import { NextRequest, NextResponse } from "next/server";
import { generateSkillDraftFromMessages } from "@/lib/llm";
import { defaultSkillPrompt } from "@/lib/skillPrompt";
import { ConversationFeedback } from "@/types/conversation";
import Anthropic from "@anthropic-ai/sdk";

type SuggestRequestBody = {
  sourceText?: string;
  sourceUrls?: string[];
  prompt?: string;
  conversationMessages?: ConversationFeedback[];
  // For update mode - provide existing skill to get incremental changes
  existingSkill?: {
    title: string;
    content: string;
    tags: string[];
  };
};

type UpdateSuggestion = {
  action: "add" | "modify" | "remove";
  section: string; // Which section this affects (e.g., "## Access Management")
  description: string; // Human-readable description of the change
  content: string; // The actual content to add/modify
};

type UpdateResponse = {
  title: string;
  tags: string[];
  suggestions: UpdateSuggestion[];
  summary: string; // Brief summary of all changes
};

export async function POST(request: NextRequest) {
  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceText = body?.sourceText?.trim() ?? "";
  const sourceUrls = Array.isArray(body?.sourceUrls)
    ? body.sourceUrls
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
    : [];

  const conversationMessages = extractConversationMessages(body?.conversationMessages);
  const existingSkill = body?.existingSkill;

  if (!sourceText && sourceUrls.length === 0 && conversationMessages.length === 0) {
    return NextResponse.json(
      { error: "Provide conversationMessages or at least one valid source entry." },
      { status: 400 },
    );
  }

  try {
    const promptText = (body?.prompt ?? "").trim() || defaultSkillPrompt;

    // If we have an existing skill, use update mode
    if (existingSkill && (sourceText || sourceUrls.length > 0)) {
      const mergedSource = await buildSourceMaterial(sourceText, sourceUrls);
      const updateResult = await generateSkillUpdate(existingSkill, mergedSource, sourceUrls);
      return NextResponse.json({
        updateMode: true,
        existingSkill,
        updates: updateResult,
        sourceUrls,
      });
    }

    // Original create mode
    if (conversationMessages.length > 0) {
      const draft = await generateSkillDraftFromMessages(conversationMessages, promptText);
      return NextResponse.json({ draft });
    }

    const mergedSource = await buildSourceMaterial(sourceText, sourceUrls);
    const initialMessage = formatInitialMessage(mergedSource);
    const draft = await generateSkillDraftFromMessages(
      [{ role: "user", content: initialMessage }],
      promptText,
    );
    return NextResponse.json({ draft, initialMessage });
  } catch (error) {
    console.error("Failed to generate skill draft:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate skill draft. Please try again later.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

async function generateSkillUpdate(
  existingSkill: { title: string; content: string; tags: string[] },
  newSourceContent: string,
  sourceUrls: string[]
): Promise<UpdateResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are a knowledge management expert helping to update existing security documentation skills with new information.

Your task is to compare an existing skill document with new source material and suggest INCREMENTAL CHANGES - not a complete rewrite.

IMPORTANT PRINCIPLES:
1. PRESERVE existing content that is still accurate
2. ADD new information that doesn't exist in the current skill
3. MODIFY sections only where the new source has updated/different information
4. REMOVE information only if the new source explicitly contradicts it
5. Be surgical - suggest the minimum changes needed to incorporate new information

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "title": "keep same or suggest new title if topic changed",
  "tags": ["keep existing tags", "add new relevant ones"],
  "summary": "Brief 1-2 sentence summary of what's new in the source material",
  "suggestions": [
    {
      "action": "add" | "modify" | "remove",
      "section": "Section name where change applies (e.g., '## Access Management' or 'New Section: ## Backup Procedures')",
      "description": "Human-readable explanation of what this change does and why",
      "content": "The actual content to add or the modified content. For 'add', this is new text. For 'modify', this is the replacement text for that section."
    }
  ]
}

GUIDELINES:
- If new source adds info about a topic already in the skill, suggest "modify" to that section
- If new source covers a new topic not in the skill, suggest "add" with a new section
- If new source has different/updated facts, suggest "modify" with explanation
- Keep the original writing style and formatting conventions
- Each suggestion should be specific and actionable
- Include enough context in "content" that the user understands what will change`;

  const userPrompt = `EXISTING SKILL:
Title: ${existingSkill.title}
Tags: ${existingSkill.tags.join(", ")}

Current Content:
${existingSkill.content}

---

NEW SOURCE MATERIAL:
${newSourceContent}

${sourceUrls.length > 0 ? `\nSource URLs: ${sourceUrls.join(", ")}` : ""}

---

Analyze the new source material and suggest incremental updates to the existing skill. Focus on:
1. What NEW information does the source contain that's not in the skill?
2. What information in the skill needs UPDATING based on the source?
3. Is any existing information now OUTDATED or contradicted?

Return ONLY the JSON object with your suggestions.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  // Parse JSON response
  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    const lines = jsonText.split("\n");
    lines.shift();
    if (lines[lines.length - 1].trim() === "```") {
      lines.pop();
    }
    jsonText = lines.join("\n");
  }

  const parsed = JSON.parse(jsonText) as UpdateResponse;
  return parsed;
}

async function buildSourceMaterial(sourceText: string, sourceUrls: string[]): Promise<string> {
  const sections: string[] = [];
  if (sourceText.trim()) {
    sections.push(sourceText.trim());
  }

  for (const url of sourceUrls) {
    const text = await fetchUrlContent(url);
    if (text) {
      sections.push(`Source: ${url}\n${text}`);
    }
  }

  if (sections.length === 0) {
    throw new Error("Unable to load any content from the provided sources.");
  }

  const combined = sections.join("\n\n---\n\n").trim();
  return combined.slice(0, 100000);
}

function formatInitialMessage(sourceText: string): string {
  return ["Source material:", sourceText.trim(), "", "Return ONLY JSON in the expected shape."].join(
    "\n",
  );
}

function extractConversationMessages(
  messages: ConversationFeedback[] | undefined,
): ConversationFeedback[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      const role = message?.role === "assistant" ? "assistant" : "user";
      const content = typeof message?.content === "string" ? message.content.trim() : "";
      return { role, content };
    })
    .filter((message): message is ConversationFeedback => message.content.length > 0);
}

async function fetchUrlContent(urlString: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    console.warn(`Skipping invalid URL: ${urlString}`);
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    console.warn(`Skipping unsupported protocol: ${urlString}`);
    return null;
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "TransparentRfpSkillBot/1.0" },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch ${urlString}: ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text")) {
      console.warn(`Skipping non-text content from ${urlString}`);
      return null;
    }

    const text = await response.text();
    return text.slice(0, 20000);
  } catch (error) {
    console.warn(`Error fetching ${urlString}:`, error);
    return null;
  }
}
