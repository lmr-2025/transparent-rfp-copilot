import { defaultSkillPrompt } from "./skillPrompt";
import { defaultQuestionPrompt } from "./questionPrompt";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, getModel, LLM_PARAMS, type ModelSpeed } from "./config";
import { buildCacheableSystem } from "./anthropicCache";
import { startTrace, recordTrace, type EntityLink } from "./tracing";

// Re-export ModelSpeed for consumers
export type { ModelSpeed } from "./config";

export type UsageInfo = {
  inputTokens: number;
  outputTokens: number;
  model: string;
  /** Tokens written to Anthropic prompt cache (1.25x cost) */
  cacheCreationTokens?: number;
  /** Tokens read from Anthropic prompt cache (0.1x cost - 90% savings!) */
  cacheReadTokens?: number;
};

export type SkillDraft = {
  title: string;
  content: string;
  sourceMapping?: string[];
  usage?: UsageInfo;
};

export type ConversationFeedback = {
  role: string;
  content: string;
};

export async function generateSkillDraftFromMessages(
  messages: ConversationFeedback[],
  promptText = defaultSkillPrompt,
): Promise<SkillDraft> {
  const sanitized = sanitizeConversationMessages(messages);
  if (sanitized.length === 0) {
    throw new Error("At least one conversation message is required to generate a skill draft.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Please configure it in .env.local.");
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const traceContext = startTrace("generate_skill_draft", "skills");
  const userMessage = sanitized.map((m) => `${m.role}: ${m.content}`).join("\n");
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: LLM_PARAMS.maxTokens,
      temperature: LLM_PARAMS.temperature.precise,
      system: promptText,
      messages: sanitized.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    });

    const latencyMs = Date.now() - startTime;

    const content = response.content[0];
    if (content.type !== "text" || !content.text?.trim()) {
      throw new Error("Claude returned an empty response.");
    }

    const responseText = content.text.trim();
    const parsed = parseJsonContent(responseText);
    // If LLM returned an array of skills, take the first one
    const skillData = Array.isArray(parsed) ? parsed[0] : parsed;
    const draft = normalizeSkillDraft(skillData);

    await recordTrace(
      traceContext,
      { model: CLAUDE_MODEL, systemPrompt: promptText, userMessage },
      {
        response: responseText,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
      latencyMs
    );

    draft.usage = {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      model: CLAUDE_MODEL,
    };
    return draft;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate skill draft: ${error.message}`);
    }
    throw new Error("Failed to generate skill draft.");
  }
}

export type AnswerResult = {
  answer: string;
  conversationHistory: { role: string; content: string }[];
  usedFallback: boolean;
  usage?: UsageInfo;
  traceId?: string; // For feedback correlation
};

export type FallbackContent = {
  title: string;
  url: string;
  content: string;
};

export type TracingOptions = {
  userId?: string;
  userEmail?: string;
  entityLink?: EntityLink;
  parentTraceId?: string;
};

export async function answerQuestionWithPrompt(
  question: string,
  promptText = defaultQuestionPrompt,
  skills?: { title: string; content: string; id?: string }[],
  fallbackContent?: FallbackContent[],
  modelSpeed: ModelSpeed = "quality",
  tracingOptions?: TracingOptions,
): Promise<AnswerResult> {
  const trimmedQuestion = question?.trim();
  if (!trimmedQuestion) {
    throw new Error("A question is required to generate a response.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Please configure it in .env.local.");
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  // Build skills context if provided
  let skillsContext = "";
  const hasSkills = skills && skills.length > 0;

  if (hasSkills) {
    const skillBlocks = skills.map((skill, index) => {
      return [
        `### Skill ${index + 1}: ${skill.title}`,
        "",
        skill.content,
      ].join("\n");
    });

    skillsContext = [
      "# AVAILABLE SKILLS (Reference Material)",
      "",
      "The following pre-verified skills are available for reference when answering this question. Use these as your primary source of truth:",
      "",
      ...skillBlocks,
      "",
      "---",
      "",
    ].join("\n");
  }

  // Build fallback URL content if no skills matched and fallback content provided
  let fallbackContext = "";
  const usedFallback = !hasSkills && fallbackContent && fallbackContent.length > 0;

  if (usedFallback) {
    const fallbackBlocks = fallbackContent
      .filter((fb) => fb.content.trim().length > 0)
      .map((fb, index) => {
        return [
          `### Reference ${index + 1}: ${fb.title}`,
          `Source: ${fb.url}`,
          "",
          fb.content,
        ].join("\n");
      });

    if (fallbackBlocks.length > 0) {
      fallbackContext = [
        "# REFERENCE DOCUMENTS (Fallback Context)",
        "",
        "No pre-verified skills matched this question. The following reference documents were fetched as fallback context:",
        "",
        ...fallbackBlocks,
        "",
        "---",
        "",
      ].join("\n");
    }
  }

  // Combine context with the question
  const contextPrefix = skillsContext || fallbackContext;
  const userMessage = contextPrefix ? `${contextPrefix}${trimmedQuestion}` : trimmedQuestion;

  const model = getModel(modelSpeed);

  // Build cacheable system prompt (caches if above token threshold)
  const systemContent = buildCacheableSystem({
    cachedContent: promptText,
    model,
  });

  // Set up tracing context
  const traceContext = startTrace("answer_question", "questions", {
    parentTraceId: tracingOptions?.parentTraceId,
    userId: tracingOptions?.userId,
    userEmail: tracingOptions?.userEmail,
  });

  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: LLM_PARAMS.maxTokens,
      temperature: LLM_PARAMS.temperature.balanced,
      system: systemContent,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const latencyMs = Date.now() - startTime;

    const content = response.content[0];
    if (content.type !== "text" || !content.text?.trim()) {
      throw new Error("The assistant returned an empty response.");
    }

    const answerText = content.text.trim();

    // Record trace
    const traceId = await recordTrace(
      traceContext,
      {
        model,
        systemPrompt: promptText,
        userMessage,
        skills: skills?.map((s) => ({ id: s.id || "", title: s.title })),
      },
      {
        response: answerText,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cacheCreationTokens: response.usage?.cache_creation_input_tokens ?? undefined,
        cacheReadTokens: response.usage?.cache_read_input_tokens ?? undefined,
      },
      latencyMs,
      tracingOptions?.entityLink
    );

    // Build conversation history for transparency
    const conversationHistory: { role: string; content: string }[] = [
      { role: "system", content: promptText },
      { role: "user", content: userMessage },
      { role: "assistant", content: answerText },
    ];

    return {
      answer: answerText,
      conversationHistory,
      usedFallback: usedFallback || false,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        model,
        cacheCreationTokens: response.usage?.cache_creation_input_tokens ?? undefined,
        cacheReadTokens: response.usage?.cache_read_input_tokens ?? undefined,
      },
      traceId,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }
    throw new Error("Failed to generate response.");
  }
}

// Batch answer type for processing multiple questions in one API call
export type BatchAnswerItem = {
  questionIndex: number;
  response: string;
  confidence: string;
  sources: string;
  reasoning: string;
  inference: string;
  remarks: string;
};

export type BatchAnswerResult = {
  answers: BatchAnswerItem[];
  usedFallback: boolean;
  usage?: UsageInfo;
};

/**
 * Answer multiple questions in a single API call.
 * Much more efficient than calling answerQuestionWithPrompt multiple times
 * as the system prompt and skills context are only sent once.
 *
 * @param modelSpeed - "fast" for Haiku (2-5s), "quality" for Sonnet (10-30s)
 */
export async function answerQuestionsBatch(
  questions: { index: number; question: string }[],
  promptText = defaultQuestionPrompt,
  skills?: { title: string; content: string }[],
  fallbackContent?: FallbackContent[],
  modelSpeed: ModelSpeed = "quality",
): Promise<BatchAnswerResult> {
  if (!questions || questions.length === 0) {
    throw new Error("At least one question is required.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Please configure it in .env.local.");
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  // Build skills context if provided
  let skillsContext = "";
  const hasSkills = skills && skills.length > 0;

  if (hasSkills) {
    const skillBlocks = skills.map((skill, index) => {
      return [
        `### Skill ${index + 1}: ${skill.title}`,
        "",
        skill.content,
      ].join("\n");
    });

    skillsContext = [
      "# AVAILABLE SKILLS (Reference Material)",
      "",
      "The following pre-verified skills are available for reference when answering these questions. Use these as your primary source of truth:",
      "",
      ...skillBlocks,
      "",
      "---",
      "",
    ].join("\n");
  }

  // Build fallback URL content if no skills matched and fallback content provided
  let fallbackContext = "";
  const usedFallback = !hasSkills && fallbackContent && fallbackContent.length > 0;

  if (usedFallback) {
    const fallbackBlocks = fallbackContent
      .filter((fb) => fb.content.trim().length > 0)
      .map((fb, index) => {
        return [
          `### Reference ${index + 1}: ${fb.title}`,
          `Source: ${fb.url}`,
          "",
          fb.content,
        ].join("\n");
      });

    if (fallbackBlocks.length > 0) {
      fallbackContext = [
        "# REFERENCE DOCUMENTS (Fallback Context)",
        "",
        "No pre-verified skills matched these questions. The following reference documents were fetched as fallback context:",
        "",
        ...fallbackBlocks,
        "",
        "---",
        "",
      ].join("\n");
    }
  }

  // Build the questions list
  const questionsText = questions
    .map((q) => `${q.index}. ${q.question.trim()}`)
    .join("\n");

  // Build the batch instruction
  const batchInstruction = [
    "Answer each of the following questions. Return a JSON array where each element has these fields:",
    "- questionIndex: the question number (integer)",
    "- response: the complete answer",
    "- confidence: \"High\", \"Medium\", or \"Low\"",
    "- sources: which skills/documents were used (or \"None\" if answering from general knowledge)",
    "- reasoning: what information was found directly in the sources",
    "- inference: what was logically deduced or inferred (or \"None\" if everything was found directly)",
    "- remarks: any important caveats, limitations, or notes (or \"None\" if none)",
    "",
    "IMPORTANT: Return ONLY a valid JSON array. No markdown code fences, no explanations outside the JSON.",
    "",
    "Questions:",
    questionsText,
  ].join("\n");

  // Combine context with the batch instruction
  const contextPrefix = skillsContext || fallbackContext;
  const userMessage = contextPrefix ? `${contextPrefix}${batchInstruction}` : batchInstruction;

  const model = getModel(modelSpeed);

  // Build cacheable system prompt (caches if above token threshold)
  const systemContent = buildCacheableSystem({
    cachedContent: promptText,
    model,
  });

  const traceContext = startTrace("answer_questions_batch", "questions");
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: LLM_PARAMS.maxTokens,
      temperature: LLM_PARAMS.temperature.balanced,
      system: systemContent,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const latencyMs = Date.now() - startTime;

    const content = response.content[0];
    if (content.type !== "text" || !content.text?.trim()) {
      throw new Error("The assistant returned an empty response.");
    }

    const responseText = content.text.trim();

    // Parse the JSON array response
    const parsed = parseJsonContent(responseText);
    if (!Array.isArray(parsed)) {
      throw new Error("Expected JSON array response from batch answer.");
    }

    // Normalize and validate each answer
    const answers: BatchAnswerItem[] = parsed.map((item) => {
      if (!item || typeof item !== "object") {
        throw new Error("Invalid answer item in batch response.");
      }
      const obj = item as Record<string, unknown>;
      return {
        questionIndex: typeof obj.questionIndex === "number" ? obj.questionIndex : parseInt(String(obj.questionIndex), 10),
        response: String(obj.response || ""),
        confidence: String(obj.confidence || "Medium"),
        sources: String(obj.sources || "None"),
        reasoning: String(obj.reasoning || ""),
        inference: String(obj.inference || "None"),
        remarks: String(obj.remarks || "None"),
      };
    });

    await recordTrace(
      traceContext,
      { model, systemPrompt: promptText, userMessage },
      {
        response: responseText,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cacheCreationTokens: response.usage?.cache_creation_input_tokens ?? undefined,
        cacheReadTokens: response.usage?.cache_read_input_tokens ?? undefined,
      },
      latencyMs
    );

    return {
      answers,
      usedFallback: usedFallback || false,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        model,
        cacheCreationTokens: response.usage?.cache_creation_input_tokens ?? undefined,
        cacheReadTokens: response.usage?.cache_read_input_tokens ?? undefined,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate batch response: ${error.message}`);
    }
    throw new Error("Failed to generate batch response.");
  }
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = stripCodeFence(trimmed);

  try {
    return JSON.parse(withoutFence);
  } catch {
    const fallback = extractJsonObject(withoutFence);
    if (fallback) {
      try {
        return JSON.parse(fallback);
      } catch {
        // fall through to error below
      }
    }
    throw new Error("Failed to parse LLM response as JSON.");
  }
}

function stripCodeFence(value: string): string {
  if (!value.startsWith("```")) {
    return value;
  }

  const lines = value.split("\n");
  if (lines.length <= 2) {
    return value;
  }

  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1].trim();

  if (!firstLine.startsWith("```")) {
    return value;
  }

  if (lastLine === "```") {
    lines.pop();
  }

  lines.shift();
  if (lines.length > 0 && lines[0].trim().length === 0) {
    lines.shift();
  }

  return lines.join("\n").trim();
}

function extractJsonObject(value: string): string | null {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return value.slice(start, end + 1);
}

function normalizeSkillDraft(data: unknown): SkillDraft {
  if (!data || typeof data !== "object") {
    throw new Error("LLM response is not a valid object.");
  }

  const dataObj = data as Record<string, unknown>;
  const missingFields: string[] = [];
  if (!("title" in dataObj)) missingFields.push("title");
  if (!("content" in dataObj)) missingFields.push("content");

  if (missingFields.length > 0) {
    const receivedKeys = Object.keys(dataObj).slice(0, 10).join(", ");
    throw new Error(
      `LLM response missing required fields: ${missingFields.join(", ")}. ` +
      `Received keys: ${receivedKeys || "(none)"}`
    );
  }

  const { title, content } = data as Record<string, unknown>;

  if (title == null || content == null) {
    throw new Error("Skill title and content must be strings.");
  }

  const titleValue = typeof title === "string" ? title : String(title);
  const contentValue = typeof content === "string" ? content : String(content);

  const rawSourceMapping =
    "sourceMapping" in (data as Record<string, unknown>)
      ? (data as Record<string, unknown>).sourceMapping
      : undefined;

  const sourceMappingFromRoot = parseStringArray(rawSourceMapping);

  return {
    title: titleValue.trim(),
    content: contentValue.trim(),
    sourceMapping: sourceMappingFromRoot.length > 0 ? sourceMappingFromRoot : undefined,
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }
      if (entry == null) {
        return "";
      }
      try {
        return String(entry).trim();
      } catch {
        return "";
      }
    })
    .filter((entry): entry is string => Boolean(entry && entry.length > 0));
}

function sanitizeConversationMessages(
  messages?: ConversationFeedback[],
): ConversationFeedback[] {
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages
    .map((message): ConversationFeedback => {
      const role = message?.role === "assistant" ? "assistant" : "user";
      const content = typeof message?.content === "string" ? message.content.trim() : "";
      return { role, content };
    })
    .filter((message) => message.content.length > 0);
}

// ============================================
// PROGRESSIVE SKILL LOADING (Tier 2/3)
// ============================================

/**
 * Options for progressive skill loading
 */
export type ProgressiveAnswerOptions = {
  question: string;
  promptText?: string;
  tier1Skills: { title: string; content: string; id?: string }[];
  selectedCategories?: string[];
  enableTier2?: boolean;
  enableTier3?: boolean;
  modelSpeed?: ModelSpeed;
  tracingOptions?: TracingOptions;
};

/**
 * Result from progressive answer with tier information
 */
export type ProgressiveAnswerResult = AnswerResult & {
  tier: 1 | 2 | 3;
  tier2SkillsFound?: number;
  tier3SkillsFound?: number;
};

/**
 * Answer a question with progressive skill loading.
 * Tries Tier 1 (core) skills first, then searches Tier 2 (extended) and Tier 3 (library) if needed.
 */
export async function answerQuestionProgressive(
  options: ProgressiveAnswerOptions
): Promise<ProgressiveAnswerResult> {
  const {
    question,
    promptText,
    tier1Skills,
    selectedCategories,
    enableTier2 = true,
    enableTier3 = true,
    modelSpeed,
    tracingOptions,
  } = options;

  // Try with Tier 1 skills first
  const tier1Result = await answerQuestionWithPrompt(
    question,
    promptText,
    tier1Skills,
    undefined,
    modelSpeed,
    tracingOptions
  );

  // Check if answer is confident
  if (isConfidentAnswer(tier1Result.answer)) {
    return {
      ...tier1Result,
      tier: 1,
    };
  }

  // Try Tier 2: Search extended skills in selected categories
  if (enableTier2) {
    const tier2Skills = await searchSkills({
      query: question,
      categories: selectedCategories || [],
      tiers: ["extended"],
      limit: 5,
      excludeIds: tier1Skills.map((s) => s.id).filter((id): id is string => !!id),
    });

    if (tier2Skills.length > 0) {
      const tier2Result = await answerQuestionWithPrompt(
        question,
        promptText,
        [...tier1Skills, ...tier2Skills],
        undefined,
        modelSpeed,
        tracingOptions
      );

      if (isConfidentAnswer(tier2Result.answer)) {
        return {
          ...tier2Result,
          tier: 2,
          tier2SkillsFound: tier2Skills.length,
        };
      }

      // Try Tier 3: Search entire library (all categories)
      if (enableTier3) {
        const tier3Skills = await searchSkills({
          query: question,
          categories: [], // search ALL categories
          tiers: ["library"],
          limit: 5,
          excludeIds: [
            ...tier1Skills.map((s) => s.id).filter((id): id is string => !!id),
            ...tier2Skills.map((s) => s.id!),
          ],
        });

        if (tier3Skills.length > 0) {
          const allSkills = [...tier1Skills, ...tier2Skills, ...tier3Skills];

          const tier3Result = await answerQuestionWithPrompt(
            question,
            promptText,
            allSkills,
            undefined,
            modelSpeed,
            tracingOptions
          );

          return {
            ...tier3Result,
            tier: 3,
            tier2SkillsFound: tier2Skills.length,
            tier3SkillsFound: tier3Skills.length,
          };
        }
      }

      // No Tier 3 skills found, return Tier 2 result
      return {
        ...tier2Result,
        tier: 2,
        tier2SkillsFound: tier2Skills.length,
      };
    }
  }

  // No additional skills found, return Tier 1 result
  return {
    ...tier1Result,
    tier: 1,
  };
}

/**
 * Check if an answer appears confident (not expressing uncertainty)
 */
function isConfidentAnswer(answer: string): boolean {
  const lowConfidencePhrases = [
    "i don't know",
    "i'm not sure",
    "i don't have enough information",
    "i don't have information",
    "i cannot answer",
    "unable to determine",
    "insufficient information",
    "no information available",
    "not enough context",
    "cannot find",
  ];

  const normalized = answer.toLowerCase();
  const hasLowConfidence = lowConfidencePhrases.some((phrase) =>
    normalized.includes(phrase)
  );

  // Consider confident if: (1) no low-confidence phrases, AND (2) reasonable length
  return !hasLowConfidence && answer.length > 50;
}

/**
 * Search for relevant skills directly from database
 * (Server-side only - uses Prisma)
 */
async function searchSkills(params: {
  query: string;
  categories: string[];
  tiers: ("core" | "extended" | "library")[];
  limit: number;
  excludeIds: string[];
}): Promise<{ title: string; content: string; id: string }[]> {
  try {
    // Import dependencies dynamically (only available server-side)
    const { prisma } = await import("@/lib/prisma");
    const { selectRelevantSkills } = await import("@/lib/questionHelpers");
    const { getTierForCategory } = await import("@/lib/skillTiers");

    // Fetch candidate skills from database
    // Note: We fetch more broadly and filter by effective tier in-memory
    // because tierOverrides are stored in JSON and can't be efficiently queried
    const where: {
      isActive: boolean;
      categories?: { hasSome: string[] };
      id?: { notIn: string[] };
    } = {
      isActive: true,
    };

    // Filter by categories if provided and not empty
    if (params.categories && params.categories.length > 0) {
      where.categories = { hasSome: params.categories };
    }

    // Exclude already-loaded skills
    if (params.excludeIds && params.excludeIds.length > 0) {
      where.id = { notIn: params.excludeIds };
    }

    // Fetch candidate skills from database
    const allSkills = await prisma.skill.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: Math.min(params.limit * 10, 200), // Fetch more to allow for tier filtering
    });

    // Filter by effective tier based on category context
    // Use the first selected category as context, or undefined for global filtering
    const categoryContext = params.categories.length > 0 ? params.categories[0] : undefined;
    const candidateSkills = allSkills.filter((skill) => {
      const effectiveTier = getTierForCategory(skill as any, categoryContext);
      return params.tiers.includes(effectiveTier);
    });

    // Score and rank using keyword matching
    const scoredSkills = selectRelevantSkills(
      params.query,
      candidateSkills as any // Prisma Skill type is compatible with our Skill type
    );

    // Return top N skills
    return scoredSkills.slice(0, params.limit).map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
    }));
  } catch (error) {
    // Log but don't fail - just return empty array
    console.error("Failed to search skills:", error);
    return [];
  }
}

// Updated to use Claude (Anthropic) instead of OpenAI