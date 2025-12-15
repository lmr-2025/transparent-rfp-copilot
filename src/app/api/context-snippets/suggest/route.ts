import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CLAUDE_MODEL } from "@/lib/config";
import { logUsage } from "@/lib/usageTracking";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";

type SuggestSnippetRequestBody = {
  sourceText?: string;
  sourceUrls?: string[];
};

type SnippetDraft = {
  name: string;
  key: string;
  content: string;
  category: string | null;
  description: string | null;
};

export async function POST(request: NextRequest) {
  // Rate limit check - LLM tier for expensive AI calls
  const identifier = await getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, "llm");
  if (!rateLimitResult.success && rateLimitResult.error) {
    return rateLimitResult.error;
  }

  let body: SuggestSnippetRequestBody;
  try {
    body = (await request.json()) as SuggestSnippetRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceText = body?.sourceText?.trim() ?? "";
  const sourceUrls = Array.isArray(body?.sourceUrls)
    ? body.sourceUrls
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
    : [];

  if (!sourceText && sourceUrls.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one valid source entry (text or URL)." },
      { status: 400 },
    );
  }

  try {
    const authSession = await getServerSession(authOptions);
    const anthropic = getAnthropicClient();

    const mergedSource = await buildSourceMaterial(sourceText, sourceUrls);

    const systemPrompt = `You are a content specialist helping extract reusable marketing and company boilerplate text from documentation.

Your task is to create a Context Snippet - a reusable block of text that can be inserted into prompts using variable syntax like {{key}}.

WHAT MAKES A GOOD CONTEXT SNIPPET:
- Company descriptions (e.g., "Monte Carlo is a data + AI observability platform...")
- Value propositions and benefits
- Product/service descriptions
- Industry-specific positioning
- Certifications and compliance statements (e.g., "SOC 2 Type II certified")
- Standard disclaimers or legal text
- Boilerplate paragraphs used across multiple documents

SNIPPET GUIDELINES:
1. Extract the MOST reusable, self-contained content
2. Make it polished and ready to drop into any document
3. Remove source-specific references (dates, specific customers, etc.) unless they're the point
4. Keep it concise but complete - a single focused block of text
5. The key should be lowercase with underscores (e.g., company_description, security_certifications)

OUTPUT FORMAT:
Return a JSON object:
{
  "name": "Human-readable name (e.g., 'Company Description')",
  "key": "lowercase_underscore_key",
  "content": "The actual reusable text content. This should be polished prose, not structured data. Write it exactly as you'd want it to appear when the variable is expanded.",
  "category": "One of: Company, Product, Security, Compliance, Legal, Marketing, or null",
  "description": "Brief description of what this snippet is for and when to use it"
}

IMPORTANT: Return ONLY the JSON object, no other text.`;

    const userPrompt = `SOURCE MATERIAL:
${mergedSource}

${sourceUrls.length > 0 ? `\nSource URLs: ${sourceUrls.join(", ")}` : ""}

---

Extract the most valuable reusable content from this source material and create a Context Snippet.
Focus on company descriptions, value propositions, or other boilerplate that would be useful across multiple documents.

Return ONLY the JSON object.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format");
    }

    const draft = parseJsonResponse<SnippetDraft>(content.text);

    // Log usage
    logUsage({
      userId: authSession?.user?.id,
      userEmail: authSession?.user?.email,
      feature: "snippets-suggest",
      model: CLAUDE_MODEL,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      metadata: { urlCount: sourceUrls.length },
    });

    return NextResponse.json({ draft, sourceUrls });
  } catch (error) {
    console.error("Failed to generate snippet draft:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate snippet draft. Please try again later.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
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
