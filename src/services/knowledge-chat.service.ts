import Anthropic from "@anthropic-ai/sdk";
import { Skill } from "@/types/skill";
import { KnowledgeDocument } from "@/types/document";
import { ReferenceUrl } from "@/types/referenceUrl";
import { CustomerProfile } from "@/types/customer";
import { smartTruncate, buildContextString, type ContextItem } from "@/lib/smartTruncation";
import { truncateContext } from "@/lib/contextUtils";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Context limits for each type of knowledge
const CONTEXT_LIMITS = {
  skills: 100000,
  documents: 80000,
  urls: 30000,
  customers: 40000,
};

// Model selection based on mode
const MODEL_CONFIG = {
  default: "claude-3-5-sonnet-20241022" as const,
  quick: "claude-3-5-haiku-20241022" as const,
};

// Temperature settings
const TEMPERATURE_CONFIG = {
  default: 0.3,
  call: 0.2, // More deterministic for call mode
};

export interface KnowledgeChatRequest {
  message: string;
  skills: Skill[];
  customerProfiles: CustomerProfile[];
  documentIds: string[];
  referenceUrls: { id: string; url: string; title: string | null }[];
  conversationHistory: { role: string; content: string }[];
  userInstructions: string;
  quickMode?: boolean;
  callMode?: boolean;
}

export interface KnowledgeChatResponse {
  response: string;
  skillsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  documentsUsed?: { id: string; title: string }[];
  urlsUsed?: { id: string; title: string }[];
  contextTruncated?: boolean;
  transparency?: {
    systemPrompt: string;
    baseSystemPrompt?: string;
    knowledgeContext: string;
    customerContext?: string;
    documentContext?: string;
    urlContext?: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
}

/**
 * Build system prompt with knowledge context
 */
function buildSystemPrompt(params: {
  knowledgeContext: string;
  customerContext: string;
  documentContext: string;
  urlContext: string;
  userInstructions: string;
  callMode: boolean;
}): string {
  const { knowledgeContext, customerContext, documentContext, urlContext, userInstructions, callMode } = params;

  let basePrompt = callMode
    ? `You are a helpful AI assistant designed to provide ultra-brief answers during live customer calls.
Your responses should be:
- EXTREMELY CONCISE (1-3 sentences maximum)
- DIRECT and actionable
- Optimized for verbal delivery
- No long explanations or lists unless explicitly asked

Keep it short and conversational.`
    : `You are a helpful AI assistant with access to knowledge base information including skills, documents, customer profiles, and reference URLs.

Please provide accurate, helpful responses based on the knowledge provided.`;

  const sections: string[] = [basePrompt];

  if (knowledgeContext) {
    sections.push(`\n## Skills Knowledge\n${knowledgeContext}`);
  }

  if (customerContext) {
    sections.push(`\n## Customer Profiles\n${customerContext}`);
  }

  if (documentContext) {
    sections.push(`\n## Documents\n${documentContext}`);
  }

  if (urlContext) {
    sections.push(`\n## Reference URLs\n${urlContext}`);
  }

  if (userInstructions) {
    sections.push(`\n## Additional Instructions\n${userInstructions}`);
  }

  return sections.join("\n");
}

/**
 * Prepare knowledge context using smart truncation
 */
function prepareKnowledgeContext(message: string, skills: Skill[]): {
  context: string;
  truncated: boolean;
  skillsUsed: { id: string; title: string }[];
} {
  if (skills.length === 0) {
    return { context: "", truncated: false, skillsUsed: [] };
  }

  // Convert skills to ContextItems
  const skillItems: ContextItem[] = skills.map((skill) => ({
    id: skill.id,
    title: skill.title,
    content: skill.content,
    type: "skill" as const,
  }));

  // Apply smart truncation
  const truncatedSkills = smartTruncate(message, skillItems, CONTEXT_LIMITS.skills, {
    topKFullContent: 10,
    nextKSummaries: 10,
  });

  // Build context string
  const context = buildContextString(truncatedSkills.items, "skill");

  // Track skills used
  const skillsUsed = truncatedSkills.items.map((item) => ({
    id: item.id,
    title: item.title,
  }));

  return {
    context,
    truncated: truncatedSkills.truncated,
    skillsUsed,
  };
}

/**
 * Prepare customer context with legacy support
 */
function prepareCustomerContext(
  customerProfiles: CustomerProfile[]
): {
  context: string;
  truncated: boolean;
  customersUsed: { id: string; name: string }[];
} {
  if (customerProfiles.length === 0) {
    return { context: "", truncated: false, customersUsed: [] };
  }

  const customerText = customerProfiles
    .map((profile) => {
      const parts = [`### ${profile.name}`];
      if (profile.industry) parts.push(`Industry: ${profile.industry}`);

      // Use unified content field if available, otherwise fall back to legacy fields
      if (profile.content) {
        parts.push(profile.content);
      } else {
        if (profile.overview) parts.push(`Overview: ${profile.overview}`);
        if (profile.products) parts.push(`Products/Services: ${profile.products}`);
        if (profile.challenges) parts.push(`Challenges: ${profile.challenges}`);
        if (profile.keyFacts && profile.keyFacts.length > 0) {
          parts.push(
            "Key Facts:\n" +
              profile.keyFacts.map((fact) => `- ${fact.label}: ${fact.value}`).join("\n")
          );
        }
      }

      if (profile.considerations && profile.considerations.length > 0) {
        parts.push("Considerations:\n" + profile.considerations.map((c) => `- ${c}`).join("\n"));
      }

      return parts.join("\n");
    })
    .join("\n\n");

  // Apply boundary truncation for customer context
  const truncatedCustomer = truncateContext(customerText, CONTEXT_LIMITS.customers);

  const customersUsed = customerProfiles.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return {
    context: truncatedCustomer.text,
    truncated: truncatedCustomer.truncated,
    customersUsed,
  };
}

/**
 * Prepare document context using smart truncation
 */
async function prepareDocumentContext(message: string, documentIds: string[]): Promise<{
  context: string;
  truncated: boolean;
  documentsUsed: { id: string; title: string }[];
}> {
  if (documentIds.length === 0) {
    return { context: "", truncated: false, documentsUsed: [] };
  }

  // Fetch documents from API
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/documents`);
  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  const json = await res.json();
  const allDocuments: KnowledgeDocument[] = json.documents || [];

  // Filter to requested documents with text content
  const textDocuments = allDocuments.filter(
    (doc) => documentIds.includes(doc.id) && doc.content && doc.content.trim() !== ""
  );

  if (textDocuments.length === 0) {
    return { context: "", truncated: false, documentsUsed: [] };
  }

  // Convert to ContextItems
  const documentItems: ContextItem[] = textDocuments.map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content || "",
    type: "document" as const,
  }));

  // Apply smart truncation
  const truncatedDocuments = smartTruncate(message, documentItems, CONTEXT_LIMITS.documents, {
    topKFullContent: 5,
    nextKSummaries: 5,
  });

  // Build context string
  const context = buildContextString(truncatedDocuments.items, "document");

  const documentsUsed = truncatedDocuments.items.map((item) => ({
    id: item.id,
    title: item.title,
  }));

  return {
    context,
    truncated: truncatedDocuments.truncated,
    documentsUsed,
  };
}

/**
 * Prepare URL context using smart truncation
 */
function prepareUrlContext(
  message: string,
  referenceUrls: { id: string; url: string; title: string | null }[]
): {
  context: string;
  truncated: boolean;
  urlsUsed: { id: string; title: string }[];
} {
  if (referenceUrls.length === 0) {
    return { context: "", truncated: false, urlsUsed: [] };
  }

  // Convert to ContextItems (URLs have minimal content - just title and URL)
  const urlItems: ContextItem[] = referenceUrls.map((url) => ({
    id: url.id,
    title: url.title || url.url,
    content: `URL: ${url.url}`,
    type: "url" as const,
  }));

  // Apply smart truncation
  const truncatedUrls = smartTruncate(message, urlItems, CONTEXT_LIMITS.urls, {
    topKFullContent: 5,
    nextKSummaries: 5,
  });

  // Build context string
  const context = buildContextString(truncatedUrls.items, "url");

  const urlsUsed = truncatedUrls.items.map((item) => ({
    id: item.id,
    title: item.title,
  }));

  return {
    context,
    truncated: truncatedUrls.truncated,
    urlsUsed,
  };
}

/**
 * Main service method to process knowledge chat request
 */
export async function processKnowledgeChat(
  request: KnowledgeChatRequest
): Promise<KnowledgeChatResponse> {
  const {
    message,
    skills,
    customerProfiles,
    documentIds,
    referenceUrls,
    conversationHistory,
    userInstructions,
    quickMode = false,
    callMode = false,
  } = request;

  // Prepare all context sections
  const knowledgeResult = prepareKnowledgeContext(message, skills);
  const customerResult = prepareCustomerContext(customerProfiles);
  const documentResult = await prepareDocumentContext(message, documentIds);
  const urlResult = prepareUrlContext(message, referenceUrls);

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    knowledgeContext: knowledgeResult.context,
    customerContext: customerResult.context,
    documentContext: documentResult.context,
    urlContext: urlResult.context,
    userInstructions,
    callMode: callMode || false,
  });

  // Select model and temperature
  const model = quickMode ? MODEL_CONFIG.quick : MODEL_CONFIG.default;
  const temperature = callMode ? TEMPERATURE_CONFIG.call : TEMPERATURE_CONFIG.default;

  // Build conversation messages
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    {
      role: "user" as const,
      content: message,
    },
  ];

  // Call Claude API
  const response = await anthropic.messages.create({
    model,
    max_tokens: callMode ? 300 : 8192,
    temperature,
    system: systemPrompt,
    messages,
  });

  // Extract response text
  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "No response generated";

  // Check if any context was truncated
  const contextTruncated =
    knowledgeResult.truncated ||
    customerResult.truncated ||
    documentResult.truncated ||
    urlResult.truncated;

  return {
    response: responseText,
    skillsUsed: knowledgeResult.skillsUsed,
    customersUsed: customerResult.customersUsed,
    documentsUsed: documentResult.documentsUsed,
    urlsUsed: urlResult.urlsUsed,
    contextTruncated,
    transparency: {
      systemPrompt,
      knowledgeContext: knowledgeResult.context,
      customerContext: customerResult.context,
      documentContext: documentResult.context,
      urlContext: urlResult.context,
      model,
      maxTokens: callMode ? 300 : 8192,
      temperature,
    },
  };
}
