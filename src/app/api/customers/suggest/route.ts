import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CLAUDE_MODEL } from "@/lib/config";
import { CustomerProfileDraft, CustomerProfileKeyFact } from "@/types/customerProfile";
import { logUsage } from "@/lib/usageTracking";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { getAnthropicClient, parseJsonResponse, fetchUrlContent } from "@/lib/apiHelpers";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

type SuggestRequestBody = {
  sourceUrls: string[];
  prompt?: string; // Optional custom prompt (uses default sections if not provided)
  documentContent?: string; // Text content extracted from uploaded documents
  documentNames?: string[]; // Names of uploaded documents
  existingProfile?: {
    name: string;
    overview: string;
    products?: string;
    challenges?: string;
    keyFacts: CustomerProfileKeyFact[];
  };
};

export async function POST(request: NextRequest) {
  // Rate limit check - LLM tier for expensive AI calls
  const identifier = await getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, "llm");
  if (!rateLimitResult.success && rateLimitResult.error) {
    return rateLimitResult.error;
  }

  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch {
    return errors.badRequest("Invalid JSON body.");
  }

  const sourceUrls = Array.isArray(body?.sourceUrls)
    ? body.sourceUrls.map((url) => url.trim()).filter((url) => url.length > 0)
    : [];

  const documentContent = body?.documentContent?.trim() || "";
  const documentNames = body?.documentNames || [];

  if (sourceUrls.length === 0 && !documentContent) {
    return errors.badRequest("Provide at least one source URL or upload a document.");
  }

  try {
    const authSession = await getServerSession(authOptions);
    const sourceContent = await buildSourceMaterial(sourceUrls, documentContent);

    // Load prompt from database (block system) or use default
    const promptText = body?.prompt?.trim() || await loadSystemPrompt("customer_profile", "You are creating a customer profile document.");

    if (body.existingProfile) {
      // Update mode
      const result = await generateProfileUpdate(
        body.existingProfile,
        sourceContent,
        sourceUrls,
        promptText,
        authSession
      );
      return apiSuccess({
        updateMode: true,
        ...result,
        sourceUrls,
      });
    }

    // Create mode
    const result = await generateProfileDraft(sourceContent, sourceUrls, promptText, documentNames, authSession);
    return apiSuccess({ draft: result.draft, sourceUrls, transparency: result.transparency });
  } catch (error) {
    logger.error("Failed to generate customer profile", error, { route: "/api/customers/suggest" });
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate customer profile. Please try again later.";
    return errors.internal(message);
  }
}

type GenerateResult = {
  draft: CustomerProfileDraft;
  transparency: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
};

async function generateProfileDraft(
  sourceContent: string,
  sourceUrls: string[],
  promptText: string,
  documentNames: string[] = [],
  authSession: { user?: { id?: string; email?: string | null } } | null = null
): Promise<GenerateResult> {
  const anthropic = getAnthropicClient();

  // Build source info
  const sourceInfo = [];
  if (sourceUrls.length > 0) {
    sourceInfo.push(`Source URLs: ${sourceUrls.join(", ")}`);
  }
  if (documentNames.length > 0) {
    sourceInfo.push(`Uploaded documents: ${documentNames.join(", ")}`);
  }

  const userPrompt = `SOURCE MATERIAL:
${sourceContent}

${sourceInfo.join("\n")}

---

Extract a customer profile from this source material.
Return ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    temperature: 0.2,
    system: promptText,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "customers-suggest",
    model: CLAUDE_MODEL,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { mode: "create", urlCount: sourceUrls.length },
  });

  return {
    draft: parseJsonResponse<CustomerProfileDraft>(content.text),
    transparency: {
      systemPrompt: promptText,
      userPrompt,
      model: CLAUDE_MODEL,
      maxTokens: 4000,
      temperature: 0.2,
    },
  };
}

async function generateProfileUpdate(
  existingProfile: {
    name: string;
    overview: string;
    products?: string;
    challenges?: string;
    keyFacts: CustomerProfileKeyFact[];
  },
  sourceContent: string,
  sourceUrls: string[],
  promptText: string,
  authSession: { user?: { id?: string; email?: string | null } } | null = null
): Promise<{
  draft: CustomerProfileDraft;
  hasChanges: boolean;
  changeHighlights: string[];
}> {
  const anthropic = getAnthropicClient();

  const systemPrompt = `${promptText}

---

IMPORTANT: You are UPDATING an existing customer profile with new information.

DECISION PROCESS:
1. Compare the existing profile with the new source material
2. If there's significant new information → update the draft and set hasChanges: true
3. If the source is redundant → return existing profile with hasChanges: false

WHAT COUNTS AS SIGNIFICANT:
- New facts not in the current profile
- Updated information (new funding, new products, acquisitions)
- Corrections to existing information
- New challenges or initiatives

OUTPUT FORMAT:
{
  "hasChanges": true/false,
  "changeHighlights": ["Brief bullet about what changed", ...],
  "name": "...",
  "industry": "...",
  "website": "...",
  "overview": "... (complete updated overview)",
  "products": "...",
  "challenges": "...",
  "keyFacts": [...]
}`;

  const userPrompt = `EXISTING PROFILE:
Name: ${existingProfile.name}

Overview:
${existingProfile.overview}

Products:
${existingProfile.products || "Not documented"}

Challenges:
${existingProfile.challenges || "Not documented"}

Key Facts:
${existingProfile.keyFacts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "None"}

---

NEW SOURCE MATERIAL:
${sourceContent}

Source URLs: ${sourceUrls.join(", ")}

---

Review the new source material against the existing profile.
Return an updated profile with hasChanges indicating if there were significant updates.
Return ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 5000,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  const parsed = parseJsonResponse<{
    hasChanges: boolean;
    changeHighlights: string[];
  } & CustomerProfileDraft>(content.text);

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "customers-suggest",
    model: CLAUDE_MODEL,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { mode: "update", urlCount: sourceUrls.length },
  });

  return {
    hasChanges: parsed.hasChanges,
    changeHighlights: parsed.changeHighlights || [],
    draft: {
      name: parsed.name,
      industry: parsed.industry,
      website: parsed.website,
      overview: parsed.overview,
      products: parsed.products,
      challenges: parsed.challenges,
      keyFacts: parsed.keyFacts,
    },
  };
}

async function buildSourceMaterial(sourceUrls: string[], documentContent: string = ""): Promise<string> {
  // Fetch all URLs in parallel for better performance
  const urlResults = await Promise.all(
    sourceUrls.slice(0, 10).map(async (url) => {
      const text = await fetchUrlContent(url);
      return text ? `Source: ${url}\n${text}` : null;
    })
  );
  const sections = urlResults.filter((s): s is string => s !== null);

  // Add document content if provided
  if (documentContent) {
    sections.push(`=== UPLOADED DOCUMENTS ===\n\n${documentContent}`);
  }

  if (sections.length === 0) {
    throw new Error("Unable to load any content from the provided URLs or documents.");
  }

  return sections.join("\n\n---\n\n").slice(0, 80000);
}
