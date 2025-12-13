import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSkillDraftFromMessages } from "@/lib/llm";
import { defaultSkillPrompt } from "@/lib/skillPrompt";
import { ConversationFeedback } from "@/types/conversation";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";

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

// Response type for draft updates
type DraftUpdateResponse = {
  hasChanges: boolean;
  summary: string; // What changed or "No updates needed"
  title: string;
  tags: string[];
  content: string; // Complete updated content (or original if no changes)
  changeHighlights: string[]; // Brief bullets about what changed
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
    const authSession = await getServerSession(authOptions);
    const promptText = (body?.prompt ?? "").trim() || defaultSkillPrompt;

    // If we have an existing skill, use update mode
    if (existingSkill && (sourceText || sourceUrls.length > 0)) {
      const mergedSource = await buildSourceMaterial(sourceText, sourceUrls);
      // Use the new simpler draft-based approach
      const draftResult = await generateDraftUpdate(existingSkill, mergedSource, sourceUrls, authSession);
      return NextResponse.json({
        updateMode: true,
        draftMode: true,
        existingSkill,
        draft: draftResult,
        sourceUrls,
      });
    }

    // Original create mode
    if (conversationMessages.length > 0) {
      const draft = await generateSkillDraftFromMessages(conversationMessages, promptText);
      // Log usage
      if (draft.usage) {
        logUsage({
          userId: authSession?.user?.id,
          userEmail: authSession?.user?.email,
          feature: "skills-suggest",
          model: draft.usage.model,
          inputTokens: draft.usage.inputTokens,
          outputTokens: draft.usage.outputTokens,
          metadata: { mode: "create-conversation" },
        });
      }
      return NextResponse.json({ draft });
    }

    const mergedSource = await buildSourceMaterial(sourceText, sourceUrls);
    const initialMessage = formatInitialMessage(mergedSource);
    const draft = await generateSkillDraftFromMessages(
      [{ role: "user", content: initialMessage }],
      promptText,
    );
    // Log usage
    if (draft.usage) {
      logUsage({
        userId: authSession?.user?.id,
        userEmail: authSession?.user?.email,
        feature: "skills-suggest",
        model: draft.usage.model,
        inputTokens: draft.usage.inputTokens,
        outputTokens: draft.usage.outputTokens,
        metadata: { mode: "create-source", urlCount: sourceUrls.length },
      });
    }
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

// Generate updated draft by comparing existing skill with new source material
async function generateDraftUpdate(
  existingSkill: { title: string; content: string; tags: string[] },
  newSourceContent: string,
  sourceUrls: string[],
  authSession: { user?: { id?: string; email?: string | null } } | null
): Promise<DraftUpdateResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are a knowledge management expert helping organize documentation into broad, comprehensive skills.

Your task is to review an existing skill document against new source material and decide if updates are needed.

DECISION PROCESS:
1. Compare the existing skill content with the new source material
2. If the new source contains SIGNIFICANT new information, updates, or corrections → write an updated draft
3. If the new source is redundant (same info already in skill) or irrelevant → return hasChanges: false

WHAT COUNTS AS SIGNIFICANT:
- New facts, procedures, or guidelines not in the current skill
- Corrections to existing information
- Updated versions, dates, or specifications
- New sections that add value

WHAT IS NOT SIGNIFICANT:
- Same information worded differently
- Information already covered in the skill
- Tangentially related content that doesn't add value

OUTPUT FORMAT:
Return a JSON object:
{
  "hasChanges": true/false,
  "summary": "Brief explanation of what changed OR 'No significant updates - the source material is already reflected in the current skill'",
  "title": "Keep same unless topic scope changed",
  "tags": ["existing tags", "plus any new relevant ones"],
  "content": "If hasChanges=true: the COMPLETE updated skill content with changes integrated. If hasChanges=false: return the original content unchanged.",
  "changeHighlights": ["Bullet point 1 describing a change", "Bullet point 2", ...] // Empty array if no changes
}

IMPORTANT GUIDELINES:
- Preserve the original writing style and structure
- Integrate new information naturally into existing sections where appropriate
- Remove duplicate/redundant content
- Keep the document well-organized with clear headers
- The content field must be COMPLETE - not just the changes`;

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

Review the new source material against the existing skill.
- If there's significant new/changed information, return an updated draft with hasChanges=true
- If the source is redundant or doesn't add value, return hasChanges=false

Return ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 12000,
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

  const parsed = JSON.parse(jsonText) as DraftUpdateResponse;

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "skills-suggest",
    model: CLAUDE_MODEL,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { mode: "update", urlCount: sourceUrls.length },
  });

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
