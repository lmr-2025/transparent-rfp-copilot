import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { LibraryRecommendation, AnalyzeLibraryResponse } from "@/types/libraryAnalysis";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

type SkillSummary = {
  id: string;
  title: string;
  category?: string;
  categories?: string[];
  contentPreview: string; // First ~500 chars of content
};

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type AnalyzeLibraryRequest = {
  skills: SkillSummary[];
  conversational?: boolean;
  message?: string;
  conversationHistory?: ConversationMessage[];
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
    return errors.badRequest("Invalid JSON body.");
  }

  const skills = Array.isArray(body?.skills) ? body.skills : [];
  const isConversational = body.conversational === true;
  const userMessage = body.message?.trim();
  const conversationHistory = body.conversationHistory || [];

  // Determine model speed
  const speed = getEffectiveSpeed("skills-analyze-library");
  const model = getModel(speed);

  if (skills.length === 0) {
    return apiSuccess({
      recommendations: [],
      summary: "No skills to analyze. Add some skills to your knowledge library first.",
      response: "Your library is empty. Add some skills first, and I'll help you analyze and organize them.",
      healthScore: 100,
      transparency: {
        systemPrompt: "",
        userPrompt: "",
        model,
        maxTokens: 0,
        temperature: 0,
        skillCount: 0,
      },
    });
  }

  if (skills.length === 1) {
    return apiSuccess({
      recommendations: [],
      summary: "Only one skill in the library. Add more skills to enable redundancy analysis.",
      response: "You only have one skill in your library. Add more skills, and I can help identify overlaps, gaps, and organization opportunities.",
      healthScore: 100,
      transparency: {
        systemPrompt: "",
        userPrompt: "",
        model,
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

    // Build skills context
    const skillsContext = skills.map((s, idx) =>
      `[${idx + 1}] ID: ${s.id}\nTitle: ${s.title}\nCategory: ${s.category || s.categories?.[0] || "Uncategorized"}\nContent Preview: ${s.contentPreview}`
    ).join("\n\n---\n\n");

    // Use different prompts for conversational vs one-shot mode
    if (isConversational) {
      // Conversational system prompt
      const conversationalSystemPrompt = `You are a knowledge library analyst helping improve skill organization through conversation.

You have access to the user's skill library:

${skillsContext}

## Your Role

Analyze the library for:
1. **Redundancy** - Skills with overlapping content that should merge
2. **Gaps** - Missing knowledge areas based on existing coverage
3. **Organization** - Skills that need renaming or recategorizing
4. **Quality** - Skills that are too broad, too narrow, or outdated

## Conversation Style

- Be conversational and helpful
- Start with a high-level summary and health score (0-100)
- Present 2-3 findings at a time
- Be specific - name the skills and explain issues clearly
- Ask follow-up questions to understand user preferences
- Offer actionable next steps

## Response Format

For your FIRST message in a conversation, provide a summary with:
- A health score (0-100) indicating overall library organization
- 2-3 key findings with specific skill names
- What you'd recommend addressing first

Always respond conversationally - do NOT return JSON unless specifically asked.

When you identify specific recommendations, include them in this format at the END of your response:

---ANALYSIS_DATA---
{
  "healthScore": <number 0-100>,
  "recommendations": [
    {
      "type": "merge|split|rename|gap|quality",
      "priority": "high|medium|low",
      "title": "<short title>",
      "description": "<explanation>",
      "affectedSkillTitles": ["<skill name>", ...]
    }
  ]
}
---END_ANALYSIS_DATA---`;

      // Build messages for conversation
      const messages: Anthropic.MessageParam[] = [];

      // Add conversation history
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }

      // Add user's new message
      if (userMessage) {
        messages.push({
          role: "user",
          content: userMessage,
        });
      } else {
        // First message - ask for initial analysis
        messages.push({
          role: "user",
          content: "Please analyze my skill library and provide an initial assessment.",
        });
      }

      const response = await anthropic.messages.create({
        model,
        max_tokens: 4000,
        temperature: 0.3,
        system: conversationalSystemPrompt,
        messages,
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response format");
      }

      const responseText = content.text;

      // Parse out any structured analysis data from the response
      let healthScore: number | undefined;
      let recommendations: LibraryRecommendation[] = [];

      const analysisMatch = responseText.match(/---ANALYSIS_DATA---\s*([\s\S]*?)---END_ANALYSIS_DATA---/);
      if (analysisMatch) {
        try {
          const analysisData = JSON.parse(analysisMatch[1].trim());
          healthScore = typeof analysisData.healthScore === "number"
            ? Math.max(0, Math.min(100, analysisData.healthScore))
            : undefined;
          recommendations = Array.isArray(analysisData.recommendations)
            ? analysisData.recommendations.slice(0, 10).map((rec: LibraryRecommendation) => ({
                type: rec.type || "merge",
                priority: rec.priority || "medium",
                title: rec.title || "Unnamed recommendation",
                description: rec.description || "",
                affectedSkillIds: Array.isArray(rec.affectedSkillIds) ? rec.affectedSkillIds : [],
                affectedSkillTitles: Array.isArray(rec.affectedSkillTitles) ? rec.affectedSkillTitles : [],
                suggestedAction: rec.suggestedAction,
              }))
            : [];
        } catch {
          // Parsing failed, continue without structured data
        }
      }

      // Clean the response text by removing the analysis data block
      const cleanResponse = responseText.replace(/---ANALYSIS_DATA---[\s\S]*?---END_ANALYSIS_DATA---/, "").trim();

      return apiSuccess({
        response: cleanResponse,
        recommendations,
        healthScore,
        summary: cleanResponse.split("\n")[0], // First line as summary
        transparency: {
          systemPrompt: conversationalSystemPrompt,
          userPrompt: userMessage || "Initial analysis request",
          model,
          maxTokens: 4000,
          temperature: 0.3,
          skillCount: skills.length,
        },
      });
    }

    // Original one-shot JSON mode
    const systemPrompt = await loadSystemPrompt("analysis", "You are a knowledge library analyst.");

    const userPrompt = `Analyze this knowledge library for organizational issues:

${skillsContext}

Return ONLY the JSON object with your analysis.`;

    const response = await anthropic.messages.create({
      model,
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
        model,
        maxTokens: 4000,
        temperature: 0.2,
        skillCount: skills.length,
      },
    };

    return apiSuccess(result);
  } catch (error) {
    logger.error("Library analysis error", error, { route: "/api/skills/analyze-library" });
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze library";
    return errors.internal(errorMessage);
  }
}
