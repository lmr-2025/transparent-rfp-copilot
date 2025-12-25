import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSkillDraftFromMessages } from "@/lib/llm";
import { defaultSkillPrompt } from "@/lib/skillPrompt";
import { ConversationFeedback } from "@/types/conversation";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const maxDuration = 120; // 2 minutes for URL fetching + LLM generation

type SuggestRequestBody = {
  sourceText?: string;
  sourceUrls?: string[];
  prompt?: string;
  conversationMessages?: ConversationFeedback[];
  // For update mode - provide existing skill to get incremental changes
  existingSkill?: {
    title: string;
    content: string;
  };
  quickMode?: boolean;
  // User guidance for content generation (e.g., "focus on security aspects")
  notes?: string;
};

// Response type for draft updates
type DraftUpdateResponse = {
  hasChanges: boolean;
  summary: string; // What changed or "No updates needed"
  title: string;
  content: string; // Complete updated content (or original if no changes)
  changeHighlights: string[]; // Brief bullets about what changed
  // Transparency fields
  reasoning?: string; // What sources were used and how content was derived
  inference?: string; // What was inferred vs directly stated - should be "None" for skills
  sources?: string; // Which URLs/documents contributed to this content
};

export async function POST(request: NextRequest) {
  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch {
    return errors.badRequest("Invalid JSON body.");
  }

  const sourceText = body?.sourceText?.trim() ?? "";
  const sourceUrls = Array.isArray(body?.sourceUrls)
    ? body.sourceUrls
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
    : [];

  const conversationMessages = extractConversationMessages(body?.conversationMessages);
  const existingSkill = body?.existingSkill;
  const quickMode = body?.quickMode;
  const notes = body?.notes?.trim() ?? "";

  // Determine model speed (request override > user preference > system default)
  const speed = getEffectiveSpeed("skills-suggest", quickMode);
  const model = getModel(speed);

  if (!sourceText && sourceUrls.length === 0 && conversationMessages.length === 0) {
    return errors.badRequest("Provide conversationMessages or at least one valid source entry.");
  }

  try {
    const authSession = await getServerSession(authOptions);

    // Load prompt from database or use defaults
    const promptText = body?.prompt?.trim() || await loadSystemPrompt("skills", defaultSkillPrompt);

    // If we have an existing skill, use update mode
    if (existingSkill && (sourceText || sourceUrls.length > 0)) {
      const mergedSource = await buildSourceMaterial(sourceText, sourceUrls);
      // Use the new simpler draft-based approach
      const draftResult = await generateDraftUpdate(existingSkill, mergedSource, sourceUrls, authSession, model, notes);
      return apiSuccess({
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
      return apiSuccess({ draft });
    }

    const mergedSource = await buildSourceMaterial(sourceText, sourceUrls);
    const initialMessage = formatInitialMessage(mergedSource, notes);
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
    return apiSuccess({ draft, initialMessage });
  } catch (error) {
    logger.error("Failed to generate skill draft", error, { route: "/api/skills/suggest" });
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate skill draft. Please try again later.";
    return errors.internal(message);
  }
}

// Generate updated draft by comparing existing skill with new source material
async function generateDraftUpdate(
  existingSkill: { title: string; content: string },
  newSourceContent: string,
  sourceUrls: string[],
  authSession: { user?: { id?: string; email?: string | null } } | null,
  model: string,
  notes: string = ""
): Promise<DraftUpdateResponse> {
  const anthropic = getAnthropicClient();

  const systemPrompt = `You are a knowledge extraction specialist reviewing an existing skill against new source material.

YOUR GOAL: Ensure the skill comprehensively covers ALL the information from the source material.

RETURN hasChanges: true IF ANY of these are true:
- Source contains information about platforms/integrations NOT in existing skill
- Source has specific technical details (numbers, versions, capabilities) not captured
- Source describes features, limitations, or requirements not mentioned
- Source covers topics/sections that the existing skill doesn't address
- Multiple sources exist but existing skill only covers content from one

RETURN hasChanges: false ONLY IF:
- The existing skill already covers ALL topics from ALL sources
- New content is purely marketing fluff with no concrete facts
- Changes would only be cosmetic rewording of existing information

IMPORTANT: If there are multiple source URLs about different topics (e.g., Snowflake, Teradata, Salesforce) but the existing skill only covers ONE topic, you MUST add the missing topics.

DIFF-FRIENDLY EDITING:
- Make SURGICAL edits - only change what needs to change
- PRESERVE the original structure and formatting
- ADD new sections for new topics at the end
- ADD new bullet points within existing sections where appropriate
- DO NOT rewrite content that doesn't need to change

OUTPUT (JSON only):
{
  "hasChanges": true/false,
  "summary": "What new facts/sections were added" OR "Skill already covers all source content",
  "title": "Keep same unless topic scope genuinely changed",
  "content": "COMPLETE skill content including both original AND new information",
  "changeHighlights": ["Added Snowflake integration details", "Added Teradata support info", ...], // Empty if no changes
  "reasoning": "Explain which parts of the content came from which source URL/document. Be specific about what information you extracted.",
  "inference": "None" or "List any facts that were INFERRED rather than directly stated in the sources. Be honest - skills should have minimal inference.",
  "sources": "List the specific source URLs and what information came from each"
}`;

  const userPrompt = `EXISTING SKILL:
Title: ${existingSkill.title}

Current Content:
${existingSkill.content}

---

NEW SOURCE MATERIAL:
${newSourceContent}

${sourceUrls.length > 0 ? `\nSource URLs: ${sourceUrls.join(", ")}` : ""}
${notes ? `\nUSER GUIDANCE: ${notes}` : ""}

---

Review the new source material against the existing skill.
- If there's significant new/changed information, return an updated draft with hasChanges=true
- If the source is redundant or doesn't add value, return hasChanges=false
${notes ? `- Pay special attention to the user's guidance above` : ""}

Return ONLY the JSON object.`;

  // Use streaming for large outputs to avoid timeout
  const stream = anthropic.messages.stream({
    model,
    max_tokens: 32000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const response = await stream.finalMessage();

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  const parsed = parseJsonResponse<DraftUpdateResponse>(content.text);

  // Ensure content is never empty - if hasChanges is false, use original content
  if (!parsed.content || parsed.content.trim() === "") {
    parsed.content = existingSkill.content;
    parsed.hasChanges = false;
  }

  // If hasChanges is false but content differs from original (LLM error), use original
  if (!parsed.hasChanges) {
    parsed.content = existingSkill.content;
    parsed.title = existingSkill.title;
    parsed.changeHighlights = [];
  }

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "skills-suggest",
    model,
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

  // Fetch all URLs in parallel for better performance
  const urlResults = await Promise.all(
    sourceUrls.map(async (url) => {
      const text = await fetchUrlContent(url, { maxLength: 20000 });
      return text ? `Source: ${url}\n${text}` : null;
    })
  );
  sections.push(...urlResults.filter((s): s is string => s !== null));

  if (sections.length === 0) {
    throw new Error("Unable to load any content from the provided sources.");
  }

  const combined = sections.join("\n\n---\n\n").trim();
  return combined.slice(0, 100000);
}

function formatInitialMessage(sourceText: string, notes: string = ""): string {
  const parts = [
    "Source material:",
    sourceText.trim(),
  ];

  if (notes) {
    parts.push("");
    parts.push(`USER GUIDANCE: ${notes}`);
  }

  parts.push("");
  parts.push("Return a SINGLE JSON object (not an array) with: { \"title\": \"...\", \"content\": \"...\" }");

  return parts.join("\n");
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

