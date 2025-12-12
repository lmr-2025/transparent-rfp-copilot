import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/config";
import prisma from "@/lib/prisma";

type ExistingProfileInfo = {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  sourceUrls?: string[];
};

type AnalyzeRequestBody = {
  sourceUrls: string[];
  documentContent?: string; // Text content extracted from uploaded documents
  documentNames?: string[]; // Names of uploaded documents
};

type ProfileSuggestion = {
  action: "create_new" | "update_existing";
  // For update_existing
  existingProfileId?: string;
  existingProfileName?: string;
  // For create_new
  suggestedName?: string;
  suggestedIndustry?: string;
  // Explanation
  reason: string;
};

type AnalyzeResponse = {
  suggestion: ProfileSuggestion;
  sourcePreview: string;
  urlAlreadyUsed?: {
    profileId: string;
    profileName: string;
    matchedUrls: string[];
  };
  transparency?: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
};

export async function POST(request: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = (await request.json()) as AnalyzeRequestBody;
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
    // Fetch existing profiles from database
    const existingProfiles = await prisma.customerProfile.findMany({
      select: {
        id: true,
        name: true,
        industry: true,
        website: true,
        sourceUrls: true,
      },
    });

    const profileInfos: ExistingProfileInfo[] = existingProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      industry: p.industry ?? undefined,
      website: p.website ?? undefined,
      sourceUrls: (p.sourceUrls as { url: string }[] | null)?.map(
        (s) => s.url
      ),
    }));

    // Check if any URLs are already used in existing profiles
    const urlMatches = sourceUrls.length > 0 ? findUrlMatches(sourceUrls, profileInfos) : null;

    // Fetch URL content (limited) - only if we have URLs
    const urlContent = sourceUrls.length > 0 ? await fetchSourceContent(sourceUrls) : null;

    // Combine URL content and document content
    let combinedContent = "";
    if (urlContent) {
      combinedContent += urlContent;
    }
    if (documentContent) {
      if (combinedContent) {
        combinedContent += "\n\n---\n\n=== UPLOADED DOCUMENTS ===\n\n";
      }
      combinedContent += documentContent;
    }

    if (!combinedContent) {
      return NextResponse.json(
        { error: "Could not fetch any content from the provided URLs or documents." },
        { status: 400 }
      );
    }

    // Analyze with LLM
    const analysis = await analyzeContent(
      combinedContent,
      sourceUrls,
      profileInfos,
      documentNames
    );

    // If we found URL matches, include that info and potentially override suggestion
    if (urlMatches) {
      const allUrlsMatchSameProfile =
        urlMatches.matchedUrls.length === sourceUrls.length;

      if (allUrlsMatchSameProfile) {
        return NextResponse.json({
          ...analysis,
          urlAlreadyUsed: urlMatches,
          suggestion: {
            ...analysis.suggestion,
            action: "update_existing" as const,
            existingProfileId: urlMatches.profileId,
            existingProfileName: urlMatches.profileName,
            reason: `These URLs were previously used to build the "${urlMatches.profileName}" profile. Updating will refresh it with the latest content.`,
          },
        });
      }

      return NextResponse.json({
        ...analysis,
        urlAlreadyUsed: urlMatches,
      });
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Failed to analyze URLs:", error);
    const message =
      error instanceof Error ? error.message : "Unable to analyze URLs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function findUrlMatches(
  inputUrls: string[],
  existingProfiles: ExistingProfileInfo[]
): { profileId: string; profileName: string; matchedUrls: string[] } | null {
  const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/+$/, "");

  for (const profile of existingProfiles) {
    if (!profile.sourceUrls || profile.sourceUrls.length === 0) continue;

    const profileUrlsNormalized = profile.sourceUrls.map(normalizeUrl);
    const matchedUrls = inputUrls.filter((url) =>
      profileUrlsNormalized.includes(normalizeUrl(url))
    );

    if (matchedUrls.length > 0) {
      return {
        profileId: profile.id,
        profileName: profile.name,
        matchedUrls,
      };
    }
  }

  return null;
}

async function fetchSourceContent(urls: string[]): Promise<string | null> {
  const sections: string[] = [];

  for (const url of urls.slice(0, 10)) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;

      const response = await fetch(parsed.toString(), {
        headers: { "User-Agent": "TransparentTrust/1.0" },
      });
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text")) continue;

      const text = await response.text();
      sections.push(`Source: ${url}\n${text.slice(0, 8000)}`);
    } catch {
      continue;
    }
  }

  if (sections.length === 0) return null;
  return sections.join("\n\n---\n\n").slice(0, 50000);
}

async function analyzeContent(
  sourceContent: string,
  sourceUrls: string[],
  existingProfiles: ExistingProfileInfo[],
  documentNames: string[] = []
): Promise<AnalyzeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const profilesSummary =
    existingProfiles.length > 0
      ? existingProfiles
          .map(
            (p) =>
              `- "${p.name}" (ID: ${p.id})\n  Industry: ${p.industry || "unknown"}\n  Website: ${p.website || "unknown"}`
          )
          .join("\n\n")
      : "No existing customer profiles in the system.";

  const systemPrompt = `You are helping identify and organize customer information.

Your task is to analyze source material (likely a company website, press release, or case study) and determine:
1. Which company/customer this is about
2. Whether we already have a profile for this customer

DECISION RULES:
- If the content is about a company we already have a profile for → UPDATE_EXISTING
- If it's a new company → CREATE_NEW

OUTPUT FORMAT:
Return a JSON object:
{
  "suggestion": {
    "action": "create_new" | "update_existing",

    // For update_existing:
    "existingProfileId": "id of the profile to update",
    "existingProfileName": "name of the company",

    // For create_new:
    "suggestedName": "Official company name",
    "suggestedIndustry": "Primary industry category",

    "reason": "Brief explanation"
  },
  "sourcePreview": "2-3 sentence summary of what company and content this is about"
}

MATCHING RULES:
- Match on company name (accounting for variations like "Inc", "Corp", etc.)
- Match on website domain
- When in doubt, suggest update_existing to avoid duplicates`;

  // Build source summary
  const sourceSummary = [];
  if (sourceUrls.length > 0) {
    sourceSummary.push(`${sourceUrls.length} URL(s):\n${sourceUrls.join("\n")}`);
  }
  if (documentNames.length > 0) {
    sourceSummary.push(`${documentNames.length} uploaded document(s):\n${documentNames.join("\n")}`);
  }

  const userPrompt = `EXISTING CUSTOMER PROFILES:
${profilesSummary}

---

NEW SOURCE MATERIAL FROM ${sourceSummary.join("\n\n")}

Content preview:
${sourceContent}

---

Identify which company this content is about and whether we should create a new profile or update an existing one.

Return ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    temperature: 0.1,
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

  const parsed = JSON.parse(jsonText) as AnalyzeResponse;

  // Add transparency data
  return {
    ...parsed,
    transparency: {
      systemPrompt,
      userPrompt,
      model: CLAUDE_MODEL,
      maxTokens: 1500,
      temperature: 0.1,
    },
  };
}
