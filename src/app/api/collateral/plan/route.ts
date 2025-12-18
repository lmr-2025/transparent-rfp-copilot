import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getModel } from "@/lib/config";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

// Fallback prompt in case the prompt blocks fail to load
const FALLBACK_PLANNING_PROMPT = `You are a sales enablement expert helping users plan what collateral to create for a specific customer.

You have access to customer context, knowledge skills, and GTM data. Your job is to:
1. Review what's known about this customer
2. Recommend 2-3 high-impact collateral pieces
3. For each, specify: type, template, sections, and customer-specific focus

Be conversational. Ask 1-2 clarifying questions if needed.
When the user approves, output the plan in this format:

---COLLATERAL_PLAN---
Collateral:
- [Name]: Type: [type], Template: [template or custom], Priority: [priority], Sections: [sections], Focus: [focus]
---END_PLAN---`;

type Message = {
  role: "assistant" | "user";
  content: string;
};

type CustomerContext = {
  id: string;
  name: string;
  industry?: string;
  region?: string;
  tier?: string;
  content?: string;
  considerations?: string[];
};

type SkillContext = {
  id: string;
  title: string;
  contentPreview: string;
};

type GTMContext = {
  gongCalls?: Array<{
    id: string;
    title: string;
    date: string;
    summary?: string;
  }>;
  hubspotActivities?: Array<{
    id: string;
    type: string;
    date: string;
    subject: string;
  }>;
};

type TemplateContext = {
  id: string;
  name: string;
  category: string | null;
  description?: string | null;
  content?: string; // Template content with placeholders
};

type CollateralPlanRequest = {
  message: string;
  conversationHistory: Message[];
  context: {
    customer?: CustomerContext;
    skills?: SkillContext[];
    gtm?: GTMContext;
    template?: TemplateContext; // Single template for content generation
    templates?: TemplateContext[]; // Legacy: list of available templates
    userInstructions?: string;
  };
};

// Parse the collateral plan from the response
function parseCollateralPlan(response: string): {
  collateral: Array<{
    name: string;
    type: string;
    template: string;
    priority: string;
    sections: string[];
    focus: string;
  }>;
} | null {
  const planMatch = response.match(/---COLLATERAL_PLAN---\s*([\s\S]*?)---END_PLAN---/);
  if (!planMatch) return null;

  const planContent = planMatch[1].trim();
  const collateral: Array<{
    name: string;
    type: string;
    template: string;
    priority: string;
    sections: string[];
    focus: string;
  }> = [];

  // Parse collateral lines
  const lines = planContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse collateral line: "- [Name]: Type: [type], Template: [template], Priority: [priority], Sections: [sections], Focus: [focus]"
    const collateralMatch = trimmed.match(
      /^-\s*(.+?):\s*Type:\s*(.+?),\s*Template:\s*(.+?),\s*Priority:\s*(.+?),\s*Sections?:\s*(.+?),\s*Focus:\s*(.+)$/i
    );
    if (collateralMatch) {
      const [, name, type, template, priority, sectionsStr, focus] = collateralMatch;
      collateral.push({
        name: name.trim(),
        type: type.trim().toLowerCase(),
        template: template.trim(),
        priority: priority.trim().toLowerCase(),
        sections: sectionsStr.split(/[,;]/).map((s: string) => s.trim()),
        focus: focus.trim(),
      });
    }
  }

  return collateral.length > 0 ? { collateral } : null;
}

// Strip data blocks from response for cleaner display
function stripDataBlocks(response: string): string {
  let cleaned = response;
  // Remove ---SLIDE_DATA---, ---BVA_DATA---, ---DATA--- blocks with END marker
  cleaned = cleaned.replace(/---(?:BVA_DATA|SLIDE_DATA|DATA)---[\s\S]*?---END_(?:DATA|BVA_DATA|SLIDE_DATA)---/gi, "");
  // Also remove blocks without END marker (from marker to end of string)
  cleaned = cleaned.replace(/---(?:BVA_DATA|SLIDE_DATA|DATA)---[\s\S]*$/gi, "");
  // Clean up excessive whitespace left behind
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

// Parse key-value data from markdown table or structured format
// Supports: markdown tables, "Key: Value" lines, and ---BVA_DATA--- blocks
function parseKeyValueData(response: string): Record<string, string> | null {
  const data: Record<string, string> = {};
  let foundData = false;

  // Check for ---BVA_DATA--- or ---SLIDE_DATA--- blocks with END marker
  const blockMatchWithEnd = response.match(/---(BVA_DATA|SLIDE_DATA|DATA)---\s*([\s\S]*?)---END_(?:DATA|BVA_DATA|SLIDE_DATA)---/i);
  if (blockMatchWithEnd) {
    const blockContent = blockMatchWithEnd[2].trim();
    // Parse the block content
    parseKeyValueLines(blockContent, data);
    foundData = Object.keys(data).length > 0;
  }

  // If no END marker found, try to parse content after ---SLIDE_DATA--- to end of response
  if (!foundData) {
    const blockMatchNoEnd = response.match(/---(BVA_DATA|SLIDE_DATA|DATA)---\s*([\s\S]+)$/i);
    if (blockMatchNoEnd) {
      const blockContent = blockMatchNoEnd[2].trim();
      // Parse the block content (may be the rest of the response)
      parseKeyValueLines(blockContent, data);
      foundData = Object.keys(data).length > 0;
    }
  }

  // Check for markdown table format: | Key | Value |
  const tableMatch = response.match(/\|[^\n]+\|[^\n]+\|[\s\S]*?\n(?:\|[-:]+\|[-:]+\|[\s\S]*?\n)?((?:\|[^\n]+\|[^\n]+\|\n?)+)/);
  if (tableMatch && !foundData) {
    const tableRows = tableMatch[1].trim().split("\n");
    for (const row of tableRows) {
      // Parse table row: | Key | Value |
      const cells = row.split("|").map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        const key = cells[0].trim();
        const value = cells[1].trim();
        // Skip separator rows and headers
        if (!key.match(/^[-:]+$/) && key.toLowerCase() !== "key" && key.toLowerCase() !== "field") {
          data[key] = value;
          foundData = true;
        }
      }
    }
  }

  // Check for "Key: Value" format throughout the response
  if (!foundData) {
    parseKeyValueLines(response, data);
    foundData = Object.keys(data).length > 0;
  }

  return foundData ? data : null;
}

// Helper to parse "Key: Value" lines
function parseKeyValueLines(content: string, data: Record<string, string>): void {
  const lines = content.split("\n");
  for (const line of lines) {
    // Match "Key: Value" or "**Key:** Value" or "- Key: Value"
    const kvMatch = line.match(/^(?:\*\*)?[-•]?\s*([^:|\n]+?)(?:\*\*)?\s*:\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim().replace(/^\*\*|\*\*$/g, "");
      const value = kvMatch[2].trim();
      // Skip common non-data lines
      if (!key.match(/^(note|example|tip|warning)$/i) && value.length > 0) {
        data[key] = value;
      }
    }
  }
}

// GET - Fetch the system prompt for transparency
export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const systemPrompt = await loadSystemPrompt(
      "collateral_planning",
      FALLBACK_PLANNING_PROMPT
    );

    const model = getModel("quality");

    // Also fetch available templates for context
    const templates = await prisma.template.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    return apiSuccess({
      systemPrompt,
      model,
      templates,
    });
  } catch (error) {
    logger.error("Failed to fetch planning prompt", error, {
      route: "/api/collateral/plan",
    });
    return errors.internal("Failed to fetch prompts");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  try {
    const body = (await request.json()) as CollateralPlanRequest;
    const { message, conversationHistory, context } = body;

    if (!message?.trim()) {
      return errors.badRequest("Message is required");
    }

    // Load the planning system prompt
    const systemPrompt = await loadSystemPrompt(
      "collateral_planning",
      FALLBACK_PLANNING_PROMPT
    );

    // Build context about what we know
    const contextStr = buildContextString(context);

    // Build the full system prompt with context
    const fullSystemPrompt = `${systemPrompt}

## Available Context

${contextStr}`;

    // Build conversation messages
    const messages: Anthropic.MessageParam[] = [
      ...(conversationHistory || []).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    const anthropic = new Anthropic();
    const model = getModel("quality"); // Use quality model for better planning

    // Use higher token limit when filling templates with many placeholders
    const hasTemplate = !!context.template?.content;
    const maxTokens = hasTemplate ? 8000 : 2000;

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: fullSystemPrompt,
      messages,
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    // Try to parse a collateral plan from the response
    const plan = parseCollateralPlan(responseText);

    // Try to parse key-value data (for BVA, slide data, etc.)
    const slideData = parseKeyValueData(responseText);

    // Clean the response for display (strip out data blocks)
    const displayResponse = slideData ? stripDataBlocks(responseText) : responseText;

    return apiSuccess({
      response: displayResponse,
      plan,
      slideData, // Key-value data for filling slides
      transparency: {
        systemPrompt: fullSystemPrompt,
        model,
        customerName: context.customer?.name || null,
        skillCount: context.skills?.length || 0,
        templateCount: context.templates?.length || 0,
        hasGTMData: !!(context.gtm?.gongCalls?.length || context.gtm?.hubspotActivities?.length),
      },
    });
  } catch (error) {
    logger.error("Failed to plan collateral", error, {
      route: "/api/collateral/plan",
    });
    return errors.internal("Failed to generate response");
  }
}

function buildContextString(context: CollateralPlanRequest["context"]): string {
  const parts: string[] = [];

  // Add customer context
  if (context.customer) {
    parts.push("### Customer");
    parts.push(`**${context.customer.name}**`);
    if (context.customer.industry) {
      parts.push(`Industry: ${context.customer.industry}`);
    }
    if (context.customer.tier) {
      parts.push(`Tier: ${context.customer.tier}`);
    }
    if (context.customer.content) {
      parts.push(`\nProfile:\n${context.customer.content.slice(0, 1000)}${context.customer.content.length > 1000 ? "..." : ""}`);
    }
    if (context.customer.considerations?.length) {
      parts.push(`\nConsiderations:\n${context.customer.considerations.map((c) => `- ${c}`).join("\n")}`);
    }
  } else {
    parts.push("### Customer\nNo customer selected.");
  }

  // Add skills context
  if (context.skills?.length) {
    parts.push("\n### Available Skills");
    for (const skill of context.skills.slice(0, 10)) {
      parts.push(`- **${skill.title}**: ${skill.contentPreview}`);
    }
    if (context.skills.length > 10) {
      parts.push(`...and ${context.skills.length - 10} more skills`);
    }
  } else {
    parts.push("\n### Available Skills\nNo skills selected.");
  }

  // Add GTM context
  if (context.gtm?.gongCalls?.length || context.gtm?.hubspotActivities?.length) {
    parts.push("\n### GTM Data");
    if (context.gtm.gongCalls?.length) {
      parts.push(`**Recent Gong Calls (${context.gtm.gongCalls.length}):**`);
      for (const call of context.gtm.gongCalls.slice(0, 5)) {
        parts.push(`- ${call.title} (${call.date})${call.summary ? `: ${call.summary.slice(0, 100)}...` : ""}`);
      }
    }
    if (context.gtm.hubspotActivities?.length) {
      parts.push(`**Recent HubSpot Activities (${context.gtm.hubspotActivities.length}):**`);
      for (const activity of context.gtm.hubspotActivities.slice(0, 5)) {
        parts.push(`- ${activity.type}: ${activity.subject} (${activity.date})`);
      }
    }
  }

  // Add selected template context (for content generation)
  if (context.template?.content) {
    parts.push("\n### Selected Template");
    parts.push(`**${context.template.name}**${context.template.category ? ` (${context.template.category})` : ""}`);

    // Extract placeholders from template content
    const placeholders = extractPlaceholders(context.template.content);
    if (placeholders.length > 0) {
      parts.push(`\n**Placeholders to fill (${placeholders.length}):**`);
      for (const p of placeholders) {
        parts.push(`- ${p}`);
      }
      parts.push("\n**IMPORTANT:** When the user asks to 'generate all' or 'fill the template', you MUST output values for each placeholder using this EXACT format:");
      parts.push("```");
      parts.push("---SLIDE_DATA---");
      for (const p of placeholders.slice(0, 5)) {
        parts.push(`${p}: [Generated value for ${p}]`);
      }
      if (placeholders.length > 5) {
        parts.push(`... (continue for all ${placeholders.length} placeholders)`);
      }
      parts.push("---END_SLIDE_DATA---");
      parts.push("```");
    }
  } else if (context.templates?.length) {
    // Legacy: list of available templates
    parts.push("\n### Available Templates");
    for (const template of context.templates) {
      parts.push(`- **${template.name}**${template.category ? ` (${template.category})` : ""}${template.description ? `: ${template.description}` : ""}`);
    }
  } else {
    parts.push("\n### Available Templates\nNo templates available. Custom content can be generated.");
  }

  // Add user instructions if provided
  if (context.userInstructions) {
    parts.push("\n### User Instructions");
    parts.push(context.userInstructions);
  }

  return parts.join("\n");
}

// Extract placeholder names from template content
function extractPlaceholders(content: string): string[] {
  const placeholders: string[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const placeholder = match[1].trim();
    if (!placeholders.includes(placeholder)) {
      placeholders.push(placeholder);
    }
  }
  return placeholders;
}
