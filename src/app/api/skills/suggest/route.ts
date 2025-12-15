import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSkillDraftFromMessages } from "@/lib/llm";
import { defaultSkillPrompt } from "@/lib/skillPrompt";
import { ConversationFeedback } from "@/types/conversation";
import { CLAUDE_MODEL } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";

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
};

// Response type for draft updates
type DraftUpdateResponse = {
  hasChanges: boolean;
  summary: string; // What changed or "No updates needed"
  title: string;
  content: string; // Complete updated content (or original if no changes)
  changeHighlights: string[]; // Brief bullets about what changed
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

    // Load prompt from database or use defaults
    const promptText = body?.prompt?.trim() || await loadSystemPrompt("skills", defaultSkillPrompt);

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
  existingSkill: { title: string; content: string },
  newSourceContent: string,
  sourceUrls: string[],
  authSession: { user?: { id?: string; email?: string | null } } | null
): Promise<DraftUpdateResponse> {
  const anthropic = getAnthropicClient();

  const systemPrompt = `You are a knowledge extraction specialist. Your job is to distill source material into structured, fact-dense reference documents called "skills."

Your task is to review an existing skill against new source material and decide if updates are needed.

WHAT MAKES A GOOD SKILL:
- Dense with facts, not prose
- Organized for quick scanning and fact retrieval
- Complete (all relevant facts) but concise (no fluff)

DECISION PROCESS:
1. Compare the existing skill content with the new source material
2. If the new source contains NEW FACTS not already captured → update the skill
3. If the source is redundant or just marketing fluff → return hasChanges: false

WHAT TO INCLUDE:
- Concrete facts: numbers, versions, timeframes, limits, specifications
- Capabilities: what the product does, supports, integrates with
- Compliance: certifications, standards, audit results
- Processes: how things work (authentication, data handling, incident response)
- Lists: integrations, supported platforms, features (KEEP LISTS COMPLETE)
- Positioning context ONLY if it helps answer "why" or differentiates from competitors

WHAT TO REMOVE:
- Marketing language ("industry-leading", "best-in-class", "seamlessly")
- Redundant explanations of the same fact
- Generic statements that don't answer specific questions
- Narrative prose that buries the facts

OUTPUT FORMAT:
Return a JSON object:
{
  "hasChanges": true/false,
  "summary": "Brief explanation of what new facts were added",
  "title": "Keep same unless topic scope changed",
  "content": "The COMPLETE updated skill - distilled, fact-dense, organized for quick LLM parsing",
  "changeHighlights": ["New fact or section added", ...] // Empty array if no changes
}

CONTENT STRUCTURE GUIDELINES:
- Use markdown headers to organize by topic
- Use bullet points for facts and lists (easier for LLM to parse than paragraphs)
- Lead with the most important/common facts
- Group related information together
- Keep complete lists (integrations, certifications, etc.) - these answer specific questions`;

  const userPrompt = `EXISTING SKILL:
Title: ${existingSkill.title}

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

  // Use streaming for large outputs to avoid timeout
  const stream = anthropic.messages.stream({
    model: CLAUDE_MODEL,
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
    const text = await fetchUrlContent(url, { maxLength: 20000 });
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
  return [
    "Source material:",
    sourceText.trim(),
    "",
    "Return a SINGLE JSON object (not an array) with: { \"title\": \"...\", \"content\": \"...\" }",
  ].join("\n");
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

