/**
 * Template Engine
 * Handles placeholder parsing and interpolation for template-based deliverables
 */

import type {
  ParsedPlaceholder,
  PlaceholderType,
  PlaceholderMapping,
  TemplateFillContext,
} from "@/types/template";

// Regex to match placeholders: {{type.field}} or {{type:instruction}}
const PLACEHOLDER_REGEX = /\{\{([a-zA-Z_]+)[.:]([^}]+)\}\}/g;

/**
 * Parse all placeholders from template content
 */
export function parsePlaceholders(content: string): ParsedPlaceholder[] {
  const placeholders: ParsedPlaceholder[] = [];
  let match;

  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    const [fullMatch, typeStr, field] = match;
    const type = typeStr.toLowerCase() as PlaceholderType;

    placeholders.push({
      fullMatch,
      type,
      field: field.trim(),
    });
  }

  // Reset regex lastIndex for future calls
  PLACEHOLDER_REGEX.lastIndex = 0;

  return placeholders;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Format a value for template insertion
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatValue).join(", ");
  }
  if (typeof value === "object") {
    // For objects, try to create a readable representation
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Resolve a single placeholder value from context
 * Returns the resolved value or null if it requires LLM generation
 */
export function resolvePlaceholder(
  placeholder: ParsedPlaceholder,
  context: TemplateFillContext
): string | null {
  const { type, field } = placeholder;

  switch (type) {
    case "customer": {
      if (!context.customer) return "";
      const value = getNestedValue(context.customer as Record<string, unknown>, field);
      return formatValue(value);
    }

    case "gtm": {
      if (!context.gtm) return "";
      // Handle special GTM fields
      if (field === "recent_calls_summary" && context.gtm.gongCalls) {
        return context.gtm.gongCalls
          .slice(0, 3)
          .map((call) => `- ${call.title} (${call.date}): ${call.summary || "No summary"}`)
          .join("\n");
      }
      if (field === "recent_activities" && context.gtm.hubspotActivities) {
        return context.gtm.hubspotActivities
          .slice(0, 5)
          .map((a) => `- ${a.type}: ${a.subject} (${a.date})`)
          .join("\n");
      }
      if (field === "metrics_summary" && context.gtm.lookerMetrics) {
        return context.gtm.lookerMetrics
          .map((m) => {
            const metrics = Object.entries(m.metrics)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            return `${m.period}: ${metrics}`;
          })
          .join("\n");
      }
      const value = getNestedValue(context.gtm as Record<string, unknown>, field);
      return formatValue(value);
    }

    case "skill": {
      if (!context.skills || context.skills.length === 0) return "";
      // {{skill.all}} - concatenate all skill content
      if (field === "all") {
        return context.skills.map((s) => s.content).join("\n\n---\n\n");
      }
      // {{skill.titles}} - list skill titles
      if (field === "titles") {
        return context.skills.map((s) => s.title).join(", ");
      }
      // {{skill.0.content}} - specific skill by index
      const indexMatch = field.match(/^(\d+)\.(.+)$/);
      if (indexMatch) {
        const [, indexStr, subField] = indexMatch;
        const index = parseInt(indexStr, 10);
        if (context.skills[index]) {
          const skill = context.skills[index] as Record<string, unknown>;
          return formatValue(skill[subField]);
        }
      }
      return "";
    }

    case "date": {
      const now = new Date();
      switch (field) {
        case "today":
          return now.toLocaleDateString();
        case "now":
          return now.toLocaleString();
        case "iso":
          return now.toISOString();
        case "year":
          return String(now.getFullYear());
        case "month":
          return now.toLocaleDateString(undefined, { month: "long" });
        case "quarter":
          return `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
        default:
          return now.toLocaleDateString();
      }
    }

    case "custom": {
      if (!context.custom) return "";
      return context.custom[field] || "";
    }

    case "llm":
      // LLM placeholders require external processing
      return null;

    default:
      return "";
  }
}

/**
 * Result of filling a template
 */
export type FillResult = {
  content: string;
  placeholdersResolved: string[];
  placeholdersMissing: string[];
  llmPlaceholders: ParsedPlaceholder[];
};

/**
 * Fill a template with context values
 * LLM placeholders are left as-is for separate processing
 */
export function fillTemplate(
  templateContent: string,
  context: TemplateFillContext
): FillResult {
  const placeholders = parsePlaceholders(templateContent);
  const placeholdersResolved: string[] = [];
  const placeholdersMissing: string[] = [];
  const llmPlaceholders: ParsedPlaceholder[] = [];

  let filledContent = templateContent;

  for (const placeholder of placeholders) {
    if (placeholder.type === "llm") {
      llmPlaceholders.push(placeholder);
      continue;
    }

    const value = resolvePlaceholder(placeholder, context);
    if (value !== null && value !== "") {
      filledContent = filledContent.replace(placeholder.fullMatch, value);
      placeholdersResolved.push(placeholder.fullMatch);
    } else if (value === "") {
      // Replace with empty string but mark as missing
      filledContent = filledContent.replace(placeholder.fullMatch, "");
      placeholdersMissing.push(placeholder.fullMatch);
    }
  }

  return {
    content: filledContent,
    placeholdersResolved,
    placeholdersMissing,
    llmPlaceholders,
  };
}

/**
 * Build LLM prompt for filling remaining placeholders
 */
export function buildLLMFillPrompt(
  partiallyFilledContent: string,
  llmPlaceholders: ParsedPlaceholder[],
  context: TemplateFillContext
): string {
  const placeholderInstructions = llmPlaceholders
    .map((p, i) => `${i + 1}. ${p.fullMatch} - ${p.field}`)
    .join("\n");

  const contextSummary: string[] = [];

  if (context.customer) {
    contextSummary.push(`Customer: ${context.customer.name} (${context.customer.industry || "Industry not specified"})`);
    if (context.customer.content) {
      contextSummary.push(`Customer Overview:\n${context.customer.content}`);
    }
  }

  if (context.gtm?.gongCalls?.length) {
    contextSummary.push(`Recent Gong Calls: ${context.gtm.gongCalls.length} calls available`);
  }

  if (context.skills?.length) {
    contextSummary.push(`Skills Available: ${context.skills.map(s => s.title).join(", ")}`);
  }

  return `You are filling out a document template. Please generate content for the following placeholders based on the context provided.

## Placeholders to Fill
${placeholderInstructions}

## Context
${contextSummary.join("\n\n")}

## Partially Filled Template
${partiallyFilledContent}

## Instructions
For each {{llm:instruction}} placeholder, generate appropriate content based on the instruction and context.
Return ONLY the filled template with all placeholders replaced. Do not include any explanation or commentary.`;
}

/**
 * Extract placeholder hints from template for UI display
 */
export function extractPlaceholderHints(content: string): Record<string, string> {
  const placeholders = parsePlaceholders(content);
  const hints: Record<string, string> = {};

  for (const p of placeholders) {
    switch (p.type) {
      case "customer":
        hints[p.fullMatch] = `Customer field: ${p.field}`;
        break;
      case "gtm":
        hints[p.fullMatch] = `GTM data: ${p.field}`;
        break;
      case "skill":
        hints[p.fullMatch] = `Skill content: ${p.field}`;
        break;
      case "llm":
        hints[p.fullMatch] = `LLM will generate: ${p.field}`;
        break;
      case "date":
        hints[p.fullMatch] = `Date format: ${p.field}`;
        break;
      case "custom":
        hints[p.fullMatch] = `Custom value: ${p.field} (user-provided)`;
        break;
    }
  }

  return hints;
}
