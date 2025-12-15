import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { CLAUDE_MODEL } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { logUsage } from "@/lib/usageTracking";
import { knowledgeChatSchema, validateBody } from "@/lib/validations";
import { getAnthropicClient } from "@/lib/apiHelpers";
import { interpolateSnippets } from "@/lib/snippetInterpolation";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";

export const maxDuration = 60;

type ChatResponse = {
  response: string;
  skillsUsed: { id: string; title: string }[];
  customersUsed: { id: string; name: string }[];
  documentsUsed: { id: string; title: string }[];
  urlsUsed: { id: string; title: string }[];
  // Transparency data
  transparency: {
    systemPrompt: string;
    baseSystemPrompt: string; // Just instructions/guidelines, without knowledge context
    knowledgeContext: string;
    customerContext: string;
    documentContext: string;
    urlContext: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
};

export async function POST(request: NextRequest) {
  // Rate limit - LLM routes are expensive
  const identifier = await getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, "llm");
  if (!rateLimit.success && rateLimit.error) {
    return rateLimit.error;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateBody(knowledgeChatSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data;
  const message = data.message.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const skills = data.skills;
  const customerProfiles = data.customerProfiles || [];
  const documentIds = data.documentIds || [];
  const referenceUrls = data.referenceUrls || [];
  const conversationHistory = data.conversationHistory || [];
  const userInstructions = data.userInstructions || "";

  try {
    const authSession = await getServerSession(authOptions);
    const anthropic = getAnthropicClient();

    // Fetch documents content from database if any are selected
    let documents: { id: string; title: string; filename: string; content: string }[] = [];
    if (documentIds.length > 0) {
      documents = await prisma.knowledgeDocument.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, title: true, filename: true, content: true },
      });
    }

    // Build knowledge base context from skills
    const knowledgeContext = skills.length > 0
      ? skills.map((skill, idx) =>
          `=== SKILL ${idx + 1}: ${skill.title} ===\nTags: ${skill.tags.join(", ") || "none"}\n\n${skill.content}`
        ).join("\n\n---\n\n")
      : "";

    // Build document context
    const documentContext = documents.length > 0
      ? documents.map((doc, idx) =>
          `=== DOCUMENT ${idx + 1}: ${doc.title} ===\nFilename: ${doc.filename}\n\n${doc.content}`
        ).join("\n\n---\n\n")
      : "";

    // Build URL context (just include the reference info - actual fetching would require a separate call)
    const urlContext = referenceUrls.length > 0
      ? referenceUrls.map((url, idx) =>
          `=== REFERENCE URL ${idx + 1}: ${url.title} ===\nURL: ${url.url}`
        ).join("\n\n---\n\n")
      : "";

    // Build customer context from profiles
    const customerContext = customerProfiles.length > 0
      ? customerProfiles.map((profile) => {
          const keyFactsText = profile.keyFacts.length > 0
            ? `Key Facts:\n${profile.keyFacts.map(f => `  - ${f.label}: ${f.value}`).join("\n")}`
            : "";
          return `=== CUSTOMER PROFILE: ${profile.name} ===
Industry: ${profile.industry || "Not specified"}

Overview:
${profile.overview}
${profile.products ? `\nProducts & Services:\n${profile.products}` : ""}
${profile.challenges ? `\nChallenges & Needs:\n${profile.challenges}` : ""}
${keyFactsText}`;
        }).join("\n\n---\n\n")
      : "";

    // Build combined knowledge context (skills, documents, URLs - NOT customer profiles)
    let combinedKnowledgeContext = "";

    // 1. Skills (highest priority - structured knowledge)
    if (knowledgeContext) {
      combinedKnowledgeContext += `=== SKILLS (Primary Knowledge Sources) ===\n\n${knowledgeContext}`;
    }

    // 2. Documents (supporting documentation)
    if (documentContext) {
      if (combinedKnowledgeContext) combinedKnowledgeContext += "\n\n";
      combinedKnowledgeContext += `=== DOCUMENTS (Supporting Documentation) ===\n\n${documentContext}`;
    }

    // 3. Reference URLs
    if (urlContext) {
      if (combinedKnowledgeContext) combinedKnowledgeContext += "\n\n";
      combinedKnowledgeContext += `=== REFERENCE URLS ===\n\n${urlContext}`;
    }

    if (!combinedKnowledgeContext) {
      combinedKnowledgeContext = "No knowledge base documents provided.";
    }

    // Load base system prompt from the new block-based system
    const baseSystemPrompt = await loadSystemPrompt("chat", "You are a helpful assistant.");

    // Interpolate context snippets in user instructions (replace {{key}} with snippet content)
    const expandedInstructions = userInstructions
      ? await interpolateSnippets(userInstructions)
      : "";

    // Build full system prompt by adding context sections
    const contextParts: string[] = [baseSystemPrompt];

    if (expandedInstructions) {
      contextParts.push(`## User Instructions\n${expandedInstructions}`);
    }

    if (customerContext) {
      contextParts.push(`## Customer Context\n${customerContext}`);
    }

    contextParts.push(`## Knowledge Base\n${combinedKnowledgeContext}`);

    const systemPrompt = contextParts.join("\n\n");

    // Build messages array with conversation history
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format");
    }

    // Log usage asynchronously
    logUsage({
      userId: authSession?.user?.id,
      userEmail: authSession?.user?.email,
      feature: "chat",
      model: CLAUDE_MODEL,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      metadata: {
        skillCount: skills.length,
        documentCount: documents.length,
        customerCount: customerProfiles.length,
        urlCount: referenceUrls.length,
        conversationLength: conversationHistory.length,
      },
    });

    // Determine which skills were likely used (simple heuristic: check if skill title/tag is mentioned in response)
    const skillsUsed = skills
      .filter(skill =>
        content.text.toLowerCase().includes(skill.title.toLowerCase()) ||
        skill.tags.some(tag => content.text.toLowerCase().includes(tag.toLowerCase()))
      )
      .map(skill => ({ id: skill.id, title: skill.title }));

    // Determine which customer profiles were likely used
    const customersUsed = customerProfiles
      .filter(profile =>
        content.text.toLowerCase().includes(profile.name.toLowerCase()) ||
        (profile.industry && content.text.toLowerCase().includes(profile.industry.toLowerCase()))
      )
      .map(profile => ({ id: profile.id, name: profile.name }));

    // Determine which documents were likely used
    const documentsUsed = documents
      .filter(doc =>
        content.text.toLowerCase().includes(doc.title.toLowerCase()) ||
        content.text.toLowerCase().includes(doc.filename.toLowerCase())
      )
      .map(doc => ({ id: doc.id, title: doc.title }));

    // Determine which URLs were likely used
    const urlsUsed = referenceUrls
      .filter(url =>
        content.text.toLowerCase().includes(url.title.toLowerCase()) ||
        content.text.toLowerCase().includes(url.url.toLowerCase())
      )
      .map(url => ({ id: url.id, title: url.title }));

    const result: ChatResponse = {
      response: content.text,
      skillsUsed,
      customersUsed,
      documentsUsed,
      urlsUsed,
      transparency: {
        systemPrompt,
        baseSystemPrompt,
        knowledgeContext: combinedKnowledgeContext, // Use combined context for display
        customerContext,
        documentContext,
        urlContext,
        model: CLAUDE_MODEL,
        maxTokens: 4000,
        temperature: 0.3,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Knowledge chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process chat request";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
