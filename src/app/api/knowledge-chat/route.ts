import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { EditableChatSection, buildChatPromptFromSections, defaultChatSections } from "@/lib/promptSections";
import { CLAUDE_MODEL } from "@/lib/config";
import prisma from "@/lib/prisma";
import { logUsage } from "@/lib/usageTracking";

export const maxDuration = 60;

type SkillContext = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

type CustomerProfileContext = {
  id: string;
  name: string;
  industry?: string;
  overview: string;
  products?: string;
  challenges?: string;
  keyFacts: { label: string; value: string }[];
};

type ReferenceUrlContext = {
  id: string;
  url: string;
  title: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  message: string;
  skills: SkillContext[];
  customerProfiles?: CustomerProfileContext[];
  documentIds?: string[];
  referenceUrls?: ReferenceUrlContext[];
  conversationHistory?: ChatMessage[];
  chatSections?: EditableChatSection[];
};

type ChatResponse = {
  response: string;
  skillsUsed: { id: string; title: string }[];
  customersUsed: { id: string; name: string }[];
  documentsUsed: { id: string; title: string }[];
  urlsUsed: { id: string; title: string }[];
  // Transparency data
  transparency: {
    systemPrompt: string;
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
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const skills = Array.isArray(body?.skills) ? body.skills : [];
  const customerProfiles = Array.isArray(body?.customerProfiles) ? body.customerProfiles : [];
  const documentIds = Array.isArray(body?.documentIds) ? body.documentIds : [];
  const referenceUrls = Array.isArray(body?.referenceUrls) ? body.referenceUrls : [];
  const conversationHistory = Array.isArray(body?.conversationHistory) ? body.conversationHistory : [];
  const chatSections = Array.isArray(body?.chatSections) && body.chatSections.length > 0
    ? body.chatSections
    : defaultChatSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));

  try {
    const authSession = await getServerSession(authOptions);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const anthropic = new Anthropic({ apiKey });

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

    // Build combined context with priority order: Skills first, then Documents, then URLs
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

    // 4. Customer profiles
    if (customerContext) {
      if (combinedKnowledgeContext) combinedKnowledgeContext += "\n\n";
      combinedKnowledgeContext += `=== CUSTOMER INTELLIGENCE ===\n\n${customerContext}`;
    }

    if (!combinedKnowledgeContext) {
      combinedKnowledgeContext = "No knowledge base documents provided.";
    }

    // Build system prompt from configured sections
    const systemPrompt = buildChatPromptFromSections(chatSections, combinedKnowledgeContext);

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
        knowledgeContext,
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
