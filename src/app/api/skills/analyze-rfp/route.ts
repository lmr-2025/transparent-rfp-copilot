import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/config";
import { SkillCategory } from "@/types/skill";
import { getCategoryNames } from "@/lib/categoryStorage";

type RFPEntry = {
  question: string;
  answer: string;
};

type ExistingSkill = {
  id: string;
  title: string;
  category?: SkillCategory;
  tags: string[];
  content: string;
};

type SkillSuggestion = {
  type: "update" | "new";
  skillId?: string;
  skillTitle: string;
  category?: SkillCategory;
  currentContent?: string;
  suggestedAdditions: string;
  relevantQA: RFPEntry[];
  tags: string[];
};

type AnalysisResult = {
  suggestions: SkillSuggestion[];
  unmatchedEntries: RFPEntry[];
};

export const maxDuration = 120; // 2 minutes for larger RFPs

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rfpEntries = body.rfpEntries as RFPEntry[];
    const existingSkills = body.existingSkills as ExistingSkill[];

    if (!Array.isArray(rfpEntries) || rfpEntries.length === 0) {
      return NextResponse.json({ error: "No RFP entries provided" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Build the prompt
    const skillsSummary = existingSkills.length > 0
      ? existingSkills.map((s, i) => `${i + 1}. "${s.title}" (ID: ${s.id})\n   Category: ${s.category || "Uncategorized"}\n   Tags: ${s.tags.join(", ") || "none"}\n   Content preview: ${s.content.substring(0, 300)}...`).join("\n\n")
      : "No existing skills.";

    const categoriesList = getCategoryNames().join(", ");

    const rfpSummary = rfpEntries.map((e, i) =>
      `[${i + 1}] Q: ${e.question}\nA: ${e.answer}`
    ).join("\n\n---\n\n");

    const systemPrompt = `You are a knowledge management expert helping to organize security questionnaire responses into a structured skill library.

Your task is to analyze Q&A pairs from completed RFPs and suggest how to incorporate this knowledge into an existing skill library.

GOAL: Build a compact knowledge base of 15-30 comprehensive skills, NOT 100+ narrow ones.

PRINCIPLES:
1. Skills should cover BROAD CAPABILITY AREAS (like "Security & Compliance", "Data Platform", "Integrations & APIs", "Monitoring & Alerting")
2. STRONGLY PREFER updating existing skills over creating new ones
3. Only create a new skill if the content is genuinely unrelated to ALL existing skills
4. Think of skills like chapters in a book, not individual pages
5. When updating skills, add NEW information only - don't duplicate what's already there

CONSOLIDATION BIAS:
- When in doubt, UPDATE an existing skill
- A skill about "Security" can absorb content about encryption, access control, compliance, etc.
- A skill about "Integrations" can absorb content about APIs, webhooks, SSO, authentication, etc.
- A skill about "Data Platform" can absorb content about pipelines, warehouses, queries, etc.

CATEGORIES:
Every skill must belong to exactly one category. Available categories:
${categoriesList}

OUTPUT FORMAT:
You MUST respond with valid JSON in this exact structure:
{
  "suggestions": [
    {
      "type": "update" or "new",
      "skillId": "existing skill ID if type=update, omit if type=new",
      "skillTitle": "title of skill to update or create",
      "category": "One of the categories above (required for new skills)",
      "suggestedAdditions": "the actual content to add to the skill - should be well-formatted, factual statements extracted from the RFP answers",
      "relevantQAIndices": [array of Q&A indices that informed this suggestion],
      "tags": ["relevant", "tags"]
    }
  ],
  "unmatchedIndices": [array of Q&A indices that couldn't be matched to any skill topic]
}

GUIDELINES FOR SUGGESTED ADDITIONS:
- Extract factual statements, not questions
- Format as clear, professional documentation
- Use bullet points for lists
- Include specific details (tools, timeframes, processes)
- Remove any customer-specific context
- Make it reusable for future questionnaires

TITLE GUIDELINES FOR NEW SKILLS:
- Use broad titles: "Security & Compliance", "Monitoring & Observability", "Data Integration"
- Avoid narrow titles: "Password Policy", "Alert Thresholds", "Webhook Setup"
- Think: "What chapter of the docs would this belong in?"`;

    const userPrompt = `EXISTING SKILLS:
${skillsSummary}

RFP Q&A PAIRS TO ANALYZE:
${rfpSummary}

Analyze these Q&A pairs and suggest skill updates or new skills. Remember to:
1. Match Q&A pairs to existing skills by topic when possible
2. Only suggest new skills for genuinely new topics
3. Extract clean, reusable content from the answers
4. Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format");
    }

    // Parse the JSON response
    let parsed: {
      suggestions: Array<{
        type: "update" | "new";
        skillId?: string;
        skillTitle: string;
        suggestedAdditions: string;
        relevantQAIndices: number[];
        tags: string[];
      }>;
      unmatchedIndices: number[];
    };

    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```")) {
        const lines = jsonText.split("\n");
        lines.shift(); // Remove first line (```json)
        if (lines[lines.length - 1].trim() === "```") {
          lines.pop();
        }
        jsonText = lines.join("\n");
      }
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse LLM response:", content.text);
      throw new Error("Failed to parse analysis results");
    }

    // Convert indices to actual Q&A entries
    const result: AnalysisResult = {
      suggestions: parsed.suggestions.map((s) => ({
        type: s.type,
        skillId: s.skillId,
        skillTitle: s.skillTitle,
        currentContent: s.skillId
          ? existingSkills.find((sk) => sk.id === s.skillId)?.content
          : undefined,
        suggestedAdditions: s.suggestedAdditions,
        relevantQA: s.relevantQAIndices
          .filter((i) => i >= 1 && i <= rfpEntries.length)
          .map((i) => rfpEntries[i - 1]), // Convert 1-indexed to 0-indexed
        tags: s.tags || [],
      })),
      unmatchedEntries: parsed.unmatchedIndices
        .filter((i) => i >= 1 && i <= rfpEntries.length)
        .map((i) => rfpEntries[i - 1]),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("RFP analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
