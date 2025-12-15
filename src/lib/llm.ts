import { defaultSkillPrompt } from "./skillPrompt";
import { defaultQuestionPrompt } from "./questionPrompt";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "./config";

export type UsageInfo = {
  inputTokens: number;
  outputTokens: number;
  model: string;
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

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      temperature: 0.1,
      system: promptText,
      messages: sanitized.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    });

    const content = response.content[0];
    if (content.type !== "text" || !content.text?.trim()) {
      throw new Error("Claude returned an empty response.");
    }

    const parsed = parseJsonContent(content.text.trim());
    // If LLM returned an array of skills, take the first one
    const skillData = Array.isArray(parsed) ? parsed[0] : parsed;
    const draft = normalizeSkillDraft(skillData);
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
};

export type FallbackContent = {
  title: string;
  url: string;
  content: string;
};

export async function answerQuestionWithPrompt(
  question: string,
  promptText = defaultQuestionPrompt,
  skills?: { title: string; content: string }[],
  fallbackContent?: FallbackContent[],
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

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      temperature: 0.2,
      system: promptText,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text" || !content.text?.trim()) {
      throw new Error("The assistant returned an empty response.");
    }

    const answerText = content.text.trim();

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
        model: CLAUDE_MODEL,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }
    throw new Error("Failed to generate response.");
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
// Updated to use Claude (Anthropic) instead of OpenAI