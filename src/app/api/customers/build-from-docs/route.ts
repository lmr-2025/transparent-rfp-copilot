import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import mammoth from "mammoth";
import { requireAuth } from "@/lib/apiAuth";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { CustomerProfileDraft } from "@/types/customerProfile";
import { logUsage } from "@/lib/usageTracking";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const maxDuration = 120; // Allow longer for multiple docs

type ExistingProfile = {
  id: string;
  name: string;
  content: string | null;
  // Legacy fields
  overview: string;
  products: string | null;
  challenges: string | null;
};

// POST /api/customers/build-from-docs - Build/update customer profile from uploaded documents
export async function POST(request: NextRequest) {
  // Rate limit check - LLM tier for expensive AI calls
  const identifier = await getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, "llm");
  if (!rateLimitResult.success && rateLimitResult.error) {
    return rateLimitResult.error;
  }

  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const customerName = formData.get("customerName") as string | null;
    const existingProfileId = formData.get("existingProfileId") as string | null;

    if (!files || files.length === 0) {
      return errors.badRequest("No files provided. Upload at least one document.");
    }

    if (files.length > 20) {
      return errors.badRequest("Maximum 20 files allowed per request.");
    }

    // Extract text from all documents
    const documentTexts: { filename: string; text: string }[] = [];
    const supportedTypes = ["pdf", "docx", "doc", "txt"];

    for (const file of files) {
      const filename = file.name;
      const fileType = filename.split(".").pop()?.toLowerCase() || "";

      if (!supportedTypes.includes(fileType)) {
        logger.warn("Skipping unsupported file type", { filename, fileType });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        let extractedText = "";

        if (fileType === "pdf") {
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: buffer });
          const textResult = await parser.getText();
          extractedText = textResult.text;
        } else if (fileType === "docx" || fileType === "doc") {
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } else if (fileType === "txt") {
          extractedText = buffer.toString("utf-8");
        }

        if (extractedText.trim()) {
          documentTexts.push({ filename, text: extractedText });
        }
      } catch (extractError) {
        logger.warn("Failed to extract text from document", extractError, { filename });
      }
    }

    if (documentTexts.length === 0) {
      return errors.badRequest("Could not extract text from any of the uploaded files.");
    }

    // Combine all document content with clear separators
    const combinedContent = documentTexts
      .map((d) => `=== Document: ${d.filename} ===\n\n${d.text}`)
      .join("\n\n---\n\n");

    // Limit total content to avoid token limits
    const truncatedContent = combinedContent.slice(0, 80000);
    const totalTextLength = combinedContent.length;

    // Check for existing profile to update
    let existingProfile: ExistingProfile | null = null;

    if (existingProfileId) {
      existingProfile = await prisma.customerProfile.findUnique({
        where: { id: existingProfileId },
        select: {
          id: true,
          name: true,
          content: true,
          overview: true,
          products: true,
          challenges: true,
        },
      }) as ExistingProfile | null;
    }

    // Generate profile using Claude - load from block system
    const promptText = await loadSystemPrompt("customer_profile", "You are creating a customer profile document.");

    if (existingProfile) {
      // Update mode
      const result = await generateProfileUpdate(
        existingProfile,
        truncatedContent,
        documentTexts.map((d) => d.filename),
        promptText,
        auth.session
      );

      return apiSuccess({
        draft: result.draft,
        documentsProcessed: documentTexts.length,
        totalTextLength,
        existingProfileId: existingProfile.id,
        updateMode: true,
        hasChanges: result.hasChanges,
        changeHighlights: result.changeHighlights,
        transparency: result.transparency,
      });
    }

    // Create mode
    const result = await generateProfileDraft(
      truncatedContent,
      documentTexts.map((d) => d.filename),
      customerName,
      promptText,
      auth.session
    );

    return apiSuccess({
      draft: result.draft,
      documentsProcessed: documentTexts.length,
      totalTextLength,
      updateMode: false,
      transparency: result.transparency,
    });
  } catch (error) {
    logger.error("Failed to build customer profile from documents", error, { route: "/api/customers/build-from-docs" });
    const message =
      error instanceof Error
        ? error.message
        : "Unable to process documents. Please try again.";
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
  documentContent: string,
  documentNames: string[],
  customerNameHint: string | null,
  promptText: string,
  authSession: { user?: { id?: string; email?: string | null } } | null = null
): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const customerHint = customerNameHint
    ? `\n\nNote: The user indicated this is about customer "${customerNameHint}".`
    : "";

  const userPrompt = `SOURCE DOCUMENTS (${documentNames.length} files):
${documentNames.map((n) => `- ${n}`).join("\n")}

---

DOCUMENT CONTENT:
${documentContent}
${customerHint}

---

Extract a comprehensive customer profile from these documents.
These may include sales decks, meeting notes, past proposals, or other internal documents about this customer.
Return ONLY the JSON object.`;

  // Determine model speed
  const speed = getEffectiveSpeed("customers-build");
  const model = getModel(speed);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 5000,
    temperature: 0.2,
    system: promptText,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    const lines = jsonText.split("\n");
    lines.shift();
    if (lines[lines.length - 1].trim() === "```") {
      lines.pop();
    }
    jsonText = lines.join("\n");
  }

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "customers-build-from-docs",
    model,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { mode: "create", documentCount: documentNames.length },
  });

  return {
    draft: JSON.parse(jsonText) as CustomerProfileDraft,
    transparency: {
      systemPrompt: promptText,
      userPrompt,
      model,
      maxTokens: 5000,
      temperature: 0.2,
    },
  };
}

async function generateProfileUpdate(
  existingProfile: ExistingProfile,
  documentContent: string,
  documentNames: string[],
  promptText: string,
  authSession: { user?: { id?: string; email?: string | null } } | null = null
): Promise<{
  draft: CustomerProfileDraft;
  hasChanges: boolean;
  changeHighlights: string[];
  transparency: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  // Use content field if available, otherwise build from legacy fields
  const existingContent = existingProfile.content || [
    existingProfile.overview ? `## Overview\n${existingProfile.overview}` : "",
    existingProfile.products ? `## Products & Services\n${existingProfile.products}` : "",
    existingProfile.challenges ? `## Challenges & Needs\n${existingProfile.challenges}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `${promptText}

---

IMPORTANT: You are UPDATING an existing customer profile with information from new documents.

DECISION PROCESS:
1. Compare the existing profile with the new document content
2. If there's significant new information → update the draft and set hasChanges: true
3. If the documents contain redundant information → return existing profile with hasChanges: false

WHAT COUNTS AS SIGNIFICANT:
- New facts not in the current profile
- Updated information (new funding, new products, acquisitions)
- Corrections to existing information
- New challenges or initiatives
- Details about relationships, stakeholders, or opportunities

OUTPUT FORMAT:
{
  "hasChanges": true/false,
  "changeHighlights": ["Brief bullet about what changed", ...],
  "name": "...",
  "industry": "...",
  "website": "...",
  "content": "... (complete updated markdown content)",
  "considerations": ["...", ...]
}`;

  const userPrompt = `EXISTING PROFILE:
Name: ${existingProfile.name}

Content:
${existingContent}

---

NEW DOCUMENTS (${documentNames.length} files):
${documentNames.map((n) => `- ${n}`).join("\n")}

DOCUMENT CONTENT:
${documentContent}

---

Review these documents against the existing profile.
Return an updated profile with hasChanges indicating if there were significant updates.
Return ONLY the JSON object.`;

  // Determine model speed
  const speed = getEffectiveSpeed("customers-build");
  const model = getModel(speed);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 5000,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format");
  }

  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    const lines = jsonText.split("\n");
    lines.shift();
    if (lines[lines.length - 1].trim() === "```") {
      lines.pop();
    }
    jsonText = lines.join("\n");
  }

  const parsed = JSON.parse(jsonText) as {
    hasChanges: boolean;
    changeHighlights: string[];
  } & CustomerProfileDraft;

  // Log usage
  logUsage({
    userId: authSession?.user?.id,
    userEmail: authSession?.user?.email,
    feature: "customers-build-from-docs",
    model,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    metadata: { mode: "update", documentCount: documentNames.length },
  });

  return {
    hasChanges: parsed.hasChanges,
    changeHighlights: parsed.changeHighlights || [],
    draft: {
      name: parsed.name,
      industry: parsed.industry,
      website: parsed.website,
      content: parsed.content,
      considerations: parsed.considerations || [],
    },
    transparency: {
      systemPrompt,
      userPrompt,
      model,
      maxTokens: 5000,
      temperature: 0.2,
    },
  };
}
