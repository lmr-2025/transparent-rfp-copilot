import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/config";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { LibraryRecommendation, AnalyzeLibraryResponse } from "@/types/libraryAnalysis";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";

export const maxDuration = 120;

type SkillSummary = {
  id: string;
  title: string;
  tags: string[];
  contentPreview: string; // First ~500 chars of content
};

type AnalyzeLibraryRequest = {
  skills: SkillSummary[];
};

export async function POST(request: NextRequest) {
  // Rate limit check - LLM tier for expensive AI calls
  const identifier = await getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, "llm");
  if (!rateLimitResult.success && rateLimitResult.error) {
    return rateLimitResult.error;
  }

  let body: AnalyzeLibraryRequest;
  try {
    body = (await request.json()) as AnalyzeLibraryRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const skills = Array.isArray(body?.skills) ? body.skills : [];

  if (skills.length === 0) {
    return NextResponse.json({
      recommendations: [],
      summary: "No skills to analyze. Add some skills to your knowledge library first.",
      healthScore: 100,
      transparency: {
        systemPrompt: "",
        userPrompt: "",
        model: CLAUDE_MODEL,
        maxTokens: 0,
        temperature: 0,
        skillCount: 0,
      },
    });
  }

  if (skills.length === 1) {
    return NextResponse.json({
      recommendations: [],
      summary: "Only one skill in the library. Add more skills to enable redundancy analysis.",
      healthScore: 100,
      transparency: {
        systemPrompt: "",
        userPrompt: "",
        model: CLAUDE_MODEL,
        maxTokens: 0,
        temperature: 0,
        skillCount: 1,
      },
    });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const anthropic = new Anthropic({ apiKey });

    // Load system prompt from the new block-based system
    const systemPrompt = await loadSystemPrompt("analysis", "You are a knowledge library analyst.");

    const skillsContext = skills.map((s, idx) =>
      `[${idx + 1}] ID: ${s.id}\nTitle: ${s.title}\nTags: ${s.tags.join(", ") || "none"}\nContent Preview: ${s.contentPreview}`
    ).join("\n\n---\n\n");

    const userPrompt = `Analyze this knowledge library for organizational issues:

${skillsContext}

Return ONLY the JSON object with your analysis.`;

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

    const parsed = JSON.parse(jsonText) as { recommendations: LibraryRecommendation[]; summary: string; healthScore: number };

    // Validate and sanitize the response
    const result: AnalyzeLibraryResponse = {
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.slice(0, 10).map(rec => ({
            type: rec.type || "merge",
            priority: rec.priority || "medium",
            title: rec.title || "Unnamed recommendation",
            description: rec.description || "",
            affectedSkillIds: Array.isArray(rec.affectedSkillIds) ? rec.affectedSkillIds : [],
            affectedSkillTitles: Array.isArray(rec.affectedSkillTitles) ? rec.affectedSkillTitles : [],
            suggestedAction: rec.suggestedAction,
          }))
        : [],
      summary: parsed.summary || "Analysis complete.",
      healthScore: typeof parsed.healthScore === "number"
        ? Math.max(0, Math.min(100, parsed.healthScore))
        : 75,
      transparency: {
        systemPrompt,
        userPrompt,
        model: CLAUDE_MODEL,
        maxTokens: 4000,
        temperature: 0.2,
        skillCount: skills.length,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Library analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze library";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
