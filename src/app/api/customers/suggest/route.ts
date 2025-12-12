import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/config";
import {
  buildCustomerProfilePromptFromSections,
  loadCustomerProfileSections,
} from "@/lib/customerProfilePromptSections";
import { CustomerProfileDraft, CustomerProfileKeyFact } from "@/types/customerProfile";

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
    tags: string[];
  };
};

type SuggestResponse = {
  draft: CustomerProfileDraft;
  sourceUrls: string[];
  updateMode?: boolean;
  hasChanges?: boolean;
  changeHighlights?: string[];
  transparency?: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
};

export async function POST(request: NextRequest) {
  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceUrls = Array.isArray(body?.sourceUrls)
    ? body.sourceUrls.map((url) => url.trim()).filter((url) => url.length > 0)
    : [];

  const documentContent = body?.documentContent?.trim() || "";
  const documentNames = body?.documentNames || [];

  if (sourceUrls.length === 0 && !documentContent) {
    return NextResponse.json(
      { error: "Provide at least one source URL or upload a document." },
      { status: 400 }
    );
  }

  try {
    const sourceContent = await buildSourceMaterial(sourceUrls, documentContent);

    // Use provided prompt or build from default sections
    const promptText =
      body?.prompt?.trim() || buildCustomerProfilePromptFromSections(loadCustomerProfileSections());

    if (body.existingProfile) {
      // Update mode
      const result = await generateProfileUpdate(
        body.existingProfile,
        sourceContent,
        sourceUrls,
        promptText
      );
      return NextResponse.json({
        updateMode: true,
        ...result,
        sourceUrls,
      });
    }

    // Create mode
    const result = await generateProfileDraft(sourceContent, sourceUrls, promptText, documentNames);
    return NextResponse.json({ draft: result.draft, sourceUrls, transparency: result.transparency });
  } catch (error) {
    console.error("Failed to generate customer profile:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate customer profile. Please try again later.";
    return NextResponse.json({ error: message }, { status: 500 });
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
  documentNames: string[] = []
): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

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

  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    const lines = jsonText.split("\n");
    lines.shift();
    if (lines[lines.length - 1].trim() === "```") {
      lines.pop();
    }
    jsonText = lines.join("\n");
  }

  return {
    draft: JSON.parse(jsonText) as CustomerProfileDraft,
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
    tags: string[];
  },
  sourceContent: string,
  sourceUrls: string[],
  promptText: string
): Promise<{
  draft: CustomerProfileDraft;
  hasChanges: boolean;
  changeHighlights: string[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

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
  "keyFacts": [...],
  "tags": [...]
}`;

  const userPrompt = `EXISTING PROFILE:
Name: ${existingProfile.name}
Tags: ${existingProfile.tags.join(", ")}

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
      tags: parsed.tags,
    },
  };
}

async function buildSourceMaterial(sourceUrls: string[], documentContent: string = ""): Promise<string> {
  const sections: string[] = [];

  for (const url of sourceUrls.slice(0, 10)) {
    const text = await fetchUrlContent(url);
    if (text) {
      sections.push(`Source: ${url}\n${text}`);
    }
  }

  // Add document content if provided
  if (documentContent) {
    sections.push(`=== UPLOADED DOCUMENTS ===\n\n${documentContent}`);
  }

  if (sections.length === 0) {
    throw new Error("Unable to load any content from the provided URLs or documents.");
  }

  return sections.join("\n\n---\n\n").slice(0, 80000);
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
      headers: { "User-Agent": "TransparentTrust/1.0" },
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
    return text.slice(0, 15000);
  } catch (e) {
    console.warn(`Error fetching ${urlString}:`, e);
    return null;
  }
}
