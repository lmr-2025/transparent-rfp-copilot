import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadSystemPrompt } from "@/lib/loadSystemPrompt";
import { getModel, getEffectiveSpeed } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { logUsage } from "@/lib/usageTracking";
import { knowledgeChatSchema, validateBody } from "@/lib/validations";
import { getAnthropicClient } from "@/lib/apiHelpers";
import { interpolateSnippets } from "@/lib/snippetInterpolation";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { CONTEXT_LIMITS } from "@/lib/constants";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { buildGTMContextString, type CustomerGTMData } from "@/types/gtmData";

export const maxDuration = 60;

/**
 * Truncates context to fit within the maximum size limit.
 * Returns the truncated string and whether truncation occurred.
 */
function truncateContext(context: string, maxSize: number): { text: string; truncated: boolean } {
  if (context.length <= maxSize) {
    return { text: context, truncated: false };
  }
  // Truncate and add indicator
  const truncated = context.slice(0, maxSize - 50) + "\n\n[... context truncated due to size limits ...]";
  return { text: truncated, truncated: true };
}

type ChatResponse = {
  response: string;
  skillsUsed: { id: string; title: string }[];
  customersUsed: { id: string; name: string }[];
  documentsUsed: { id: string; title: string }[];
  urlsUsed: { id: string; title: string }[];
  contextTruncated?: boolean; // True if context was truncated to fit limits
  // Transparency data
  transparency: {
    systemPrompt: string;
    baseSystemPrompt: string; // Just instructions/guidelines, without knowledge context
    knowledgeContext: string;
    customerContext: string;
    documentContext: string;
    urlContext: string;
    gtmContext?: string; // GTM data from Snowflake (Gong, HubSpot, Looker)
    nativePdfDocuments?: string[]; // PDFs sent directly to Claude (not as extracted text)
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
    return errors.badRequest("Invalid JSON body.");
  }

  const validation = validateBody(knowledgeChatSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const data = validation.data;
  const message = data.message.trim();
  if (!message) {
    return errors.badRequest("Message is required.");
  }

  const skills = data.skills;
  const customerProfiles = data.customerProfiles || [];
  const documentIds = data.documentIds || [];
  const referenceUrls = data.referenceUrls || [];
  const conversationHistory = data.conversationHistory || [];
  const userInstructions = data.userInstructions || "";
  const quickMode = data.quickMode;
  const gtmData = data.gtmData;

  // Determine model speed (request override > user preference > system default)
  const speed = getEffectiveSpeed("chat", quickMode);
  const model = getModel(speed);

  try {
    const authSession = await getServerSession(authOptions);
    const anthropic = getAnthropicClient();

    // Fetch documents content from database if any are selected
    // Include fileData for PDFs to enable native Claude document support
    let documents: { id: string; title: string; filename: string; content: string; fileType: string; fileData: Uint8Array | null }[] = [];
    if (documentIds.length > 0) {
      documents = await prisma.knowledgeDocument.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, title: true, filename: true, content: true, fileType: true, fileData: true },
      });
    }

    // Separate PDFs with native file data from text-only documents
    const pdfDocuments = documents.filter(d => d.fileType === "pdf" && d.fileData);
    const textDocuments = documents.filter(d => d.fileType !== "pdf" || !d.fileData);

    // Build knowledge base context from skills
    const knowledgeContext = skills.length > 0
      ? skills.map((skill, idx) =>
          `=== SKILL ${idx + 1}: ${skill.title} ===\n\n${skill.content}`
        ).join("\n\n---\n\n")
      : "";

    // Build document context for text-only documents (PDFs with fileData are sent natively)
    const documentContext = textDocuments.length > 0
      ? textDocuments.map((doc, idx) =>
          `=== DOCUMENT ${idx + 1}: ${doc.title} ===\nFilename: ${doc.filename}\n\n${doc.content}`
        ).join("\n\n---\n\n")
      : "";

    // Build URL context (just include the reference info - actual fetching would require a separate call)
    const urlContext = referenceUrls.length > 0
      ? referenceUrls.map((url, idx) =>
          `=== REFERENCE URL ${idx + 1}: ${url.title} ===\nURL: ${url.url}`
        ).join("\n\n---\n\n")
      : "";

    // Build GTM context from Snowflake data (Gong, HubSpot, Looker)
    let gtmContext = "";
    if (gtmData) {
      // Use pre-built context string if provided, otherwise build from data
      if (gtmData.contextString) {
        gtmContext = gtmData.contextString;
      } else {
        // Build CustomerGTMData from the request data
        const gtmDataForContext: CustomerGTMData = {
          salesforceAccountId: gtmData.salesforceAccountId,
          customerName: gtmData.customerName,
          gongCalls: (gtmData.gongCalls || []).map(call => ({
            id: call.id,
            salesforceAccountId: gtmData.salesforceAccountId,
            title: call.title,
            date: call.date,
            duration: call.duration,
            participants: call.participants,
            summary: call.summary,
            transcript: call.transcript,
          })),
          hubspotActivities: (gtmData.hubspotActivities || []).map(activity => ({
            id: activity.id,
            salesforceAccountId: gtmData.salesforceAccountId,
            type: activity.type as "email" | "call" | "meeting" | "note" | "task",
            date: activity.date,
            subject: activity.subject,
            content: activity.content,
          })),
          lookerMetrics: (gtmData.lookerMetrics || []).map(metric => ({
            salesforceAccountId: gtmData.salesforceAccountId,
            period: metric.period,
            metrics: metric.metrics as Record<string, string | number>,
          })),
          lastUpdated: new Date().toISOString(),
        };
        gtmContext = buildGTMContextString(gtmDataForContext);
      }
    }

    // Fetch customer documents if customer profiles are selected
    let customerDocuments: { id: string; customerId: string; title: string; content: string; docType: string | null }[] = [];
    if (customerProfiles.length > 0) {
      const customerIds = customerProfiles.map(p => p.id);
      customerDocuments = await prisma.customerDocument.findMany({
        where: { customerId: { in: customerIds } },
        select: { id: true, customerId: true, title: true, content: true, docType: true },
      });
    }

    // Build customer context from profiles (including their documents)
    const customerContext = customerProfiles.length > 0
      ? customerProfiles.map((profile) => {
          // Get documents for this customer
          const customerDocs = customerDocuments.filter(d => d.customerId === profile.id);
          const customerDocsText = customerDocs.length > 0
            ? `\n\n## Customer Documents\n${customerDocs.map(d =>
                `### ${d.title}${d.docType ? ` (${d.docType})` : ""}\n${d.content}`
              ).join("\n\n")}`
            : "";

          // Use new content field if available, fall back to legacy fields
          const profileContent = profile.content || buildLegacyContent(profile);

          // Build considerations section if available
          const considerationsText = profile.considerations && profile.considerations.length > 0
            ? `\n\n## Considerations\n${profile.considerations.map(c => `- ${c}`).join("\n")}`
            : "";

          return `=== CUSTOMER PROFILE: ${profile.name} ===
Industry: ${profile.industry || "Not specified"}

${profileContent}${considerationsText}${customerDocsText}`;
        }).join("\n\n---\n\n")
      : "";

    // Helper function to build content from legacy fields
    function buildLegacyContent(profile: { overview?: string; products?: string; challenges?: string; keyFacts?: { label: string; value: string }[] }): string {
      const parts = [];
      if (profile.overview) parts.push(`## Overview\n${profile.overview}`);
      if (profile.products) parts.push(`## Products & Services\n${profile.products}`);
      if (profile.challenges) parts.push(`## Challenges & Needs\n${profile.challenges}`);
      if (profile.keyFacts && profile.keyFacts.length > 0) {
        parts.push(`## Key Facts\n${profile.keyFacts.map(f => `- **${f.label}:** ${f.value}`).join("\n")}`);
      }
      return parts.join("\n\n");
    }

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

    // 4. GTM Data (Gong, HubSpot, Looker from Snowflake)
    if (gtmContext) {
      if (combinedKnowledgeContext) combinedKnowledgeContext += "\n\n";
      combinedKnowledgeContext += `=== GTM DATA (Sales Intelligence) ===\n\n${gtmContext}`;
    }

    if (!combinedKnowledgeContext) {
      combinedKnowledgeContext = "No knowledge base documents provided.";
    }

    // Apply context size limits to prevent excessive API costs and context overflow
    // Allocate budget: 60% knowledge, 30% customer, 10% buffer for base prompt
    const knowledgeBudget = Math.floor(CONTEXT_LIMITS.MAX_CONTEXT * 0.6);
    const customerBudget = Math.floor(CONTEXT_LIMITS.MAX_CONTEXT * 0.3);

    const truncatedKnowledge = truncateContext(combinedKnowledgeContext, knowledgeBudget);
    const truncatedCustomer = truncateContext(customerContext, customerBudget);
    const contextTruncated = truncatedKnowledge.truncated || truncatedCustomer.truncated;

    combinedKnowledgeContext = truncatedKnowledge.text;
    const finalCustomerContext = truncatedCustomer.text;

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

    if (finalCustomerContext) {
      contextParts.push(`## Customer Context\n${finalCustomerContext}`);
    }

    contextParts.push(`## Knowledge Base\n${combinedKnowledgeContext}`);

    const systemPrompt = contextParts.join("\n\n");

    // Build messages array with conversation history
    // For PDFs with fileData, include them as native document content in the user message
    type MessageContent = string | Array<
      | { type: "text"; text: string }
      | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string }; title?: string }
    >;

    const messages: { role: "user" | "assistant"; content: MessageContent }[] = [
      ...conversationHistory,
    ];

    // Build the final user message with optional PDF documents
    if (pdfDocuments.length > 0) {
      // Include PDFs as native document content
      const userContent: Array<
        | { type: "text"; text: string }
        | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string }; title?: string }
      > = [];

      // Add PDF documents first
      for (const doc of pdfDocuments) {
        if (doc.fileData) {
          // Convert Uint8Array to base64
          const base64Data = Buffer.from(doc.fileData).toString("base64");
          userContent.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Data,
            },
            title: doc.title,
          });
        }
      }

      // Add the user's message text
      userContent.push({ type: "text", text: message });

      messages.push({ role: "user", content: userContent });
    } else {
      // No PDFs, just send the text message
      messages.push({ role: "user", content: message });
    }

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages: messages as Parameters<typeof anthropic.messages.create>[0]["messages"],
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
      model,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      metadata: {
        skillCount: skills.length,
        documentCount: documents.length,
        customerCount: customerProfiles.length,
        customerDocCount: customerDocuments.length,
        urlCount: referenceUrls.length,
        conversationLength: conversationHistory.length,
        quickMode: quickMode || false,
        hasGtmData: !!gtmData,
        gtmGongCallCount: gtmData?.gongCalls?.length || 0,
        gtmHubSpotActivityCount: gtmData?.hubspotActivities?.length || 0,
      },
    });

    // Determine which skills were likely used (simple heuristic: check if skill title is mentioned in response)
    const skillsUsed = skills
      .filter(skill =>
        content.text.toLowerCase().includes(skill.title.toLowerCase())
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
      contextTruncated,
      transparency: {
        systemPrompt,
        baseSystemPrompt,
        knowledgeContext: combinedKnowledgeContext, // Use combined context for display
        customerContext: finalCustomerContext,
        documentContext,
        urlContext,
        gtmContext: gtmContext || undefined,
        nativePdfDocuments: pdfDocuments.length > 0 ? pdfDocuments.map(d => d.title) : undefined,
        model,
        maxTokens: 4000,
        temperature: 0.3,
      },
    };

    return apiSuccess(result);
  } catch (error) {
    logger.error("Knowledge chat error", error, { route: "/api/knowledge-chat" });
    const errorMessage = error instanceof Error ? error.message : "Failed to process chat request";
    return errors.internal(errorMessage);
  }
}
