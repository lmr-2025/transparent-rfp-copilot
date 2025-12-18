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
  description: string | null;
};

type CollateralPlanRequest = {
  message: string;
  conversationHistory: Message[];
  context: {
    customer?: CustomerContext;
    skills?: SkillContext[];
    gtm?: GTMContext;
    templates?: TemplateContext[];
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

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: fullSystemPrompt,
      messages,
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    // Try to parse a collateral plan from the response
    const plan = parseCollateralPlan(responseText);

    return apiSuccess({
      response: responseText,
      plan,
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

  // Add templates context
  if (context.templates?.length) {
    parts.push("\n### Available Templates");
    for (const template of context.templates) {
      parts.push(`- **${template.name}**${template.category ? ` (${template.category})` : ""}${template.description ? `: ${template.description}` : ""}`);
    }
  } else {
    parts.push("\n### Available Templates\nNo templates available. Custom content can be generated.");
  }

  return parts.join("\n");
}
