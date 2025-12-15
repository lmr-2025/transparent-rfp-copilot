/**
 * Prompt Blocks System
 *
 * Prompts are composed from reusable building blocks.
 * Each block can have variants for different contexts (questions, skills, analysis, etc.)
 *
 * Example: "Role & Mission" block has different content for question-answering vs skill-building,
 * but the concept is the same.
 *
 * TIER SYSTEM:
 * - Tier 1 (Locked): Core system blocks - should rarely be edited. Changes can break functionality.
 * - Tier 2 (Caution): Important blocks - can be customized but with care.
 * - Tier 3 (Open): Safe to customize freely - personalization and style.
 */

// The contexts where prompts are used
export type PromptContext =
  | "questions"        // Answering RFP questions
  | "skills"           // Building knowledge skills
  | "analysis"         // Analyzing documents/libraries
  | "chat"             // Knowledge chat
  | "contracts"        // Contract analysis
  | "skill_organize"   // Organizing/merging skills from sources
  | "customer_profile" // Extracting customer profiles
  | "prompt_optimize"; // Optimizing prompt sections

// Editability tiers for blocks and modifiers
export type PromptTier = 1 | 2 | 3;

export const tierConfig: Record<PromptTier, {
  label: string;
  description: string;
  color: { bg: string; border: string; text: string };
  icon: string;
  warning?: string;
}> = {
  1: {
    label: "Locked",
    description: "Core system functionality - changes may break features",
    color: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
    icon: "🔒",
    warning: "This block controls critical system behavior. Only edit if you understand the implications.",
  },
  2: {
    label: "Caution",
    description: "Important for accuracy - customize carefully",
    color: { bg: "#fefce8", border: "#fde68a", text: "#ca8a04" },
    icon: "⚠️",
    warning: "Changes to this block may affect response quality or consistency.",
  },
  3: {
    label: "Open",
    description: "Safe to customize - style and personalization",
    color: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" },
    icon: "✏️",
  },
};

// A single building block that can have context-specific variants
export type PromptBlock = {
  id: string;
  name: string;
  description: string;
  tier: PromptTier;
  // "default" is used when no context-specific variant exists
  variants: Record<string, string> & { default: string };
};

// Which blocks are used for each context, in order
export type PromptComposition = {
  context: PromptContext;
  blockIds: string[];
  // Optional runtime additions (mode, domain)
  supportsModes?: boolean;
  supportsDomains?: boolean;
};

// Runtime modifiers (injected based on user selection)
export type PromptModifier = {
  id: string;
  name: string;
  type: "mode" | "domain";
  tier: PromptTier;
  content: string;
};

// ============================================
// DEFAULT BLOCKS
// ============================================

export const defaultBlocks: PromptBlock[] = [
  {
    id: "role_mission",
    name: "Role & Mission",
    description: "Define who the LLM is and what its primary job is.",
    tier: 3, // Open - safe to customize persona and tone
    variants: {
      default: "You are a helpful assistant.",
      questions: [
        "You are GRC Minion, a security questionnaire specialist designed to complete vendor security assessments with accurate, professional responses.",
        "Your goal is to provide fast, traceable answers based on documented security posture while maintaining accuracy and source attribution.",
        "Skills contain authoritative, pre-verified knowledge that should always be referenced first before consulting other sources.",
      ].join("\n"),
      skills: [
        "You are a knowledge extraction specialist. Your job is to distill source material into structured, fact-dense reference documents.",
        "",
        "WHAT MAKES A GOOD SKILL:",
        "- Dense with facts, not prose",
        "- Organized for quick scanning and fact retrieval",
        "- Complete (all relevant facts) but concise (no marketing fluff)",
        "",
        "INCLUDE: Concrete facts, numbers, versions, limits, capabilities, compliance info, processes, complete lists",
        "REMOVE: Marketing language, redundant explanations, generic statements, narrative prose that buries facts",
        "",
        "STRUCTURE: Use markdown headers and bullet points. Lead with important facts. Keep lists complete.",
      ].join("\n"),
      analysis: [
        "You are a document analyst specializing in compliance and security documentation.",
        "Your job is to review content and identify key information relevant to security questionnaires and compliance assessments.",
        "Prioritize extracting actionable, factual information over summaries.",
      ].join("\n"),
      chat: [
        "You are a knowledgeable assistant with access to a curated knowledge base.",
        "Answer questions conversationally while citing your sources accurately.",
        "If information isn't in your knowledge base, say so rather than guessing.",
        "",
        "FORMATTING RULES (important for readability):",
        "- Use ## for section headers (NOT **bold** - headers render differently)",
        "- Put a blank line before each header",
        "- Use bullet points (- item) for lists, not plain text lines",
        "- Put blank lines between paragraphs",
        "- Keep paragraphs short (2-3 sentences max)",
      ].join("\n"),
      contracts: [
        "You are a contract analyst specializing in security and compliance terms.",
        "Review contract language and identify key obligations, risks, and compliance-relevant clauses.",
        "Flag areas that may need legal review or pose security concerns.",
      ].join("\n"),
      skill_organize: [
        "You are a knowledge management expert helping organize documentation into a structured skill library.",
        "Your goal is to build 15-30 comprehensive, reusable skills - not 100+ fragmented ones.",
        "Prefer updating existing skills over creating new ones. Consolidate related information.",
        "Every skill should be substantial enough to answer multiple related questions.",
      ].join("\n"),
      customer_profile: [
        "You are creating a customer profile document from publicly available information about a company.",
        "This profile will be used to provide context when responding to RFPs, security questionnaires, and sales conversations for this customer.",
        "Extract accurate, factual information that helps understand the customer's business, needs, and context.",
        "Think of yourself as a research analyst preparing a briefing document.",
      ].join("\n"),
      prompt_optimize: [
        "You are a prompt engineering expert specializing in optimizing LLM prompts for clarity and efficiency.",
        "Analyze prompts for redundancy, verbosity, and unclear instructions.",
        "Suggest specific improvements while preserving the original intent.",
        "Focus on making prompts more concise without losing important context.",
      ].join("\n"),
    },
  },
  {
    id: "output_format",
    name: "Output Format",
    description: "How the LLM should structure its response.",
    tier: 1, // Locked - parsing depends on this structure
    variants: {
      default: "Provide a clear, structured response.",
      questions: [
        "Format ALL responses with these section headers:",
        "",
        "Answer: [1-3 sentence response]",
        "Confidence: [High | Medium | Low]",
        "Sources: [URLs and document references, comma-separated]",
        "Reasoning: [Which skills matched, explained conversationally]",
        "Inference: [What was inferred, or 'None' if all found directly]",
        "Remarks: [Verification notes, or 'None']",
      ].join("\n"),
      chat: [
        "End EVERY response with these metadata sections (after the main content):",
        "",
        "---",
        "Confidence: [High | Medium | Low]",
        "Sources: [Knowledge sources used, or 'General knowledge' if none]",
        "Reasoning: [Brief explanation of how you arrived at this answer]",
        "Inference: [What was inferred beyond source material, or 'None' if all found directly]",
        "Remarks: [Notes about answer quality or caveats, or 'None']",
      ].join("\n"),
      skills: [
        "Return ONLY a valid JSON object with this exact structure:",
        "",
        "{",
        '  "title": "Clear, specific title for this skill",',
        '  "content": "Distilled, fact-dense content organized for LLM parsing. Use markdown headers and bullet points. No marketing fluff."',
        "}",
        "",
        "Content should be as long as needed to capture ALL facts, but no longer. Remove prose, keep facts.",
        "Do not include any text before or after the JSON. Do not wrap in code fences. Return only the JSON object.",
      ].join("\n"),
      analysis: [
        "Structure your analysis as:",
        "",
        "Summary: [1-2 sentence overview]",
        "Key Findings: [Bulleted list of important points]",
        "Gaps: [What's missing or unclear]",
        "Recommendations: [Suggested actions or follow-ups]",
      ].join("\n"),
      contracts: [
        "Structure your analysis as:",
        "",
        "Summary: [Brief overview of the contract section]",
        "Key Terms: [Important obligations and commitments]",
        "Risk Areas: [Potential concerns or unusual clauses]",
        "Compliance Notes: [Relevant regulatory or security implications]",
      ].join("\n"),
      skill_organize: [
        "Return a JSON object with this structure:",
        "",
        "For skill suggestions:",
        '{ "suggestions": [{ "action": "create" | "update", "existingSkillId"?: string, "title": string, "content": string, "categories": string[], "source": string }] }',
        "",
        "For skill merging:",
        '{ "title": string, "content": string }',
      ].join("\n"),
      customer_profile: [
        "Return a single JSON object with this structure:",
        "{",
        '  "name": string (official company name),',
        '  "industry": string (primary industry, e.g., "Healthcare", "Financial Services", "Technology"),',
        '  "website": string (primary company website URL),',
        '  "overview": string (2-4 paragraph company overview),',
        '  "products": string (description of main products/services),',
        '  "challenges": string (known business challenges, pain points, or focus areas),',
        '  "keyFacts": [{ "label": string, "value": string }] (structured facts like Founded, Employees, Revenue, HQ),',
        '  "tags": string[] (3-8 relevant keywords for categorization, lowercase)',
        "}",
        "",
        "Return ONLY the JSON object - no markdown code fences, no explanatory text before or after.",
      ].join("\n"),
      prompt_optimize: [
        "Return a JSON object with this structure:",
        "",
        '{',
        '  "analysis": [{ "category": "REMOVE" | "SIMPLIFY" | "MERGE" | "RESTRUCTURE", "finding": string, "suggestion": string }],',
        '  "optimizedPrompt": string,',
        '  "tokenEstimate": { "before": number, "after": number, "saved": number }',
        '}',
      ].join("\n"),
    },
  },
  {
    id: "source_priority",
    name: "Source Priority",
    description: "What sources to trust and in what order.",
    tier: 2, // Caution - affects answer accuracy
    variants: {
      default: [
        "Use sources in this priority order:",
        "",
        "1. Skill Library - Pre-verified, authoritative knowledge",
        "2. Provided Documents - Uploaded context and references",
        "3. Public Documentation - Official external sources",
        "",
        "Never invent details. If information is missing, say so.",
      ].join("\n"),
    },
  },
  {
    id: "quality_rules",
    name: "Quality Rules",
    description: "Validation checks and quality standards.",
    tier: 2, // Caution - affects response quality
    variants: {
      default: [
        "Before finalizing, check:",
        "",
        "- Does the response address the specific topic asked?",
        "- For yes/no questions, is there a clear Yes or No?",
        "- Are specific terms from the question addressed?",
        "- Is everything factual and traceable to sources?",
        "",
        "Never fabricate information or compliance claims.",
      ].join("\n"),
    },
  },
  {
    id: "confidence_levels",
    name: "Confidence Levels",
    description: "How to rate and communicate certainty.",
    tier: 1, // Locked - confidence parsing depends on these exact labels
    variants: {
      default: [
        "HIGH: Explicitly stated in sources. Direct match. Answer in 1-3 sentences.",
        "",
        "MEDIUM: Reasonably inferred from documentation. Explain the inference.",
        "",
        "LOW: No documentation available. State 'Requires verification from [team]'.",
      ].join("\n"),
    },
  },
  {
    id: "processing_guidelines",
    name: "Processing Guidelines",
    description: "Specific rules for how to process and handle the input.",
    tier: 2, // Caution - affects processing behavior
    variants: {
      default: "Process the input carefully and thoroughly.",
      skill_organize: [
        "Consolidation Principles:",
        "- Prefer UPDATING existing skills over creating new ones",
        "- Merge related topics into comprehensive skills",
        "- Each skill should cover a coherent topic area",
        "- Avoid creating skills for trivial or one-off information",
        "",
        "Content Guidelines:",
        "- Extract specific facts, not vague summaries",
        "- Include relevant details like versions, dates, certifications",
        "- Use professional, consistent formatting",
        "- Remove customer-specific context - make skills reusable",
      ].join("\n"),
      customer_profile: [
        "## Overview Guidelines",
        "The 'overview' field should provide a comprehensive but concise company summary:",
        "- What the company does (core business)",
        "- Target market and customer base",
        "- Market position and competitive landscape",
        "- Brief history if relevant (founding, growth milestones)",
        "- Geographic presence and scale",
        "- Recent news, funding, or strategic initiatives",
        "",
        "Write in clear, professional prose. Be factual. Use 2-4 paragraphs, not bullet points.",
        "",
        "## Challenges & Needs",
        "For the 'challenges' field, identify:",
        "- Industry-specific challenges (regulatory, competitive, technical)",
        "- Stated priorities from press releases, earnings calls, or job postings",
        "- Technology transformation initiatives",
        "- Security or compliance requirements implied by their industry",
        "",
        "Mark inferences clearly: 'Based on their industry, they likely need...'",
        "",
        "## Key Facts",
        "Extract into 'keyFacts' when available: Founded, Headquarters, Employees, Revenue, Customers, Industry, Certifications, Tech Stack.",
        "Use ranges when exact numbers aren't available. Only include facts from source material.",
        "",
        "## INCLUDE",
        "- Company background and history",
        "- Primary products and services",
        "- Target market and customer base",
        "- Industry certifications or compliance requirements",
        "- Recent news, funding, or strategic initiatives",
        "",
        "## EXCLUDE",
        "- Personal information about individuals",
        "- Speculation not supported by sources",
        "- Marketing superlatives without substance",
        "- Pricing information",
        "- Confidential or non-public information",
      ].join("\n"),
      prompt_optimize: [
        "Analysis Categories:",
        "- REMOVE: Redundant or unnecessary content",
        "- SIMPLIFY: Overly complex instructions that can be streamlined",
        "- MERGE: Duplicate sections that should be combined",
        "- RESTRUCTURE: Poorly organized content that needs reordering",
        "",
        "Optimization Rules:",
        "- Preserve all essential instructions",
        "- Maintain the original intent and behavior",
        "- Keep critical safety and quality checks",
        "- Estimate token savings accurately",
      ].join("\n"),
    },
  },
];

// ============================================
// DEFAULT MODIFIERS (Mode/Domain)
// ============================================

export const defaultModifiers: PromptModifier[] = [
  // Modes
  {
    id: "mode_single",
    name: "Single Question Mode",
    type: "mode",
    tier: 3, // Open - style preference
    content: [
      "You are answering a single question from a user. Provide a thorough, conversational response:",
      "",
      "- Take time to fully explain the answer with context",
      "- If the question is ambiguous, address the most likely interpretation",
      "- Be helpful and educational",
    ].join("\n"),
  },
  {
    id: "mode_bulk",
    name: "Bulk Questionnaire Mode",
    type: "mode",
    tier: 3, // Open - style preference
    content: [
      "You are processing questions from a formal security questionnaire. Optimize for efficiency:",
      "",
      "- Be concise and direct",
      "- Use consistent terminology across responses",
      "- Keep responses scannable with clear Yes/No answers where applicable",
    ].join("\n"),
  },
  // Domains
  {
    id: "domain_technical",
    name: "Technical Focus",
    type: "domain",
    tier: 3, // Open - customizable focus areas
    content: [
      "This is a technical question. Focus on:",
      "- Specific implementations (protocols, algorithms, architectures)",
      "- Integration capabilities and API details",
      "- Platform/infrastructure details",
    ].join("\n"),
  },
  {
    id: "domain_legal",
    name: "Legal Focus",
    type: "domain",
    tier: 2, // Caution - legal accuracy matters
    content: [
      "This has legal/compliance implications. Be careful to:",
      "- Only state what is explicitly documented",
      "- Reference specific certifications by name",
      "- Distinguish 'we do X' vs 'we can accommodate X upon request'",
    ].join("\n"),
  },
  {
    id: "domain_security",
    name: "Security Focus",
    type: "domain",
    tier: 2, // Caution - security accuracy matters
    content: [
      "This is security-focused. Prioritize:",
      "- Specific security controls and implementations",
      "- Access control and authentication methods",
      "- Audit logging and compliance evidence",
    ].join("\n"),
  },
];

// ============================================
// DEFAULT COMPOSITIONS
// ============================================

export const defaultCompositions: PromptComposition[] = [
  {
    context: "questions",
    blockIds: ["role_mission", "source_priority", "quality_rules", "confidence_levels", "output_format"],
    supportsModes: true,
    supportsDomains: true,
  },
  {
    context: "skills",
    blockIds: ["role_mission", "quality_rules", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "analysis",
    blockIds: ["role_mission", "quality_rules", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "chat",
    blockIds: ["role_mission", "source_priority", "output_format"],
    supportsModes: false,
    supportsDomains: true,
  },
  {
    context: "contracts",
    blockIds: ["role_mission", "quality_rules", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "skill_organize",
    blockIds: ["role_mission", "processing_guidelines", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "customer_profile",
    blockIds: ["role_mission", "processing_guidelines", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
  {
    context: "prompt_optimize",
    blockIds: ["role_mission", "processing_guidelines", "output_format"],
    supportsModes: false,
    supportsDomains: false,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build a prompt string from blocks for a given context
 */
export function buildPromptFromBlocks(
  blocks: PromptBlock[],
  composition: PromptComposition,
  options?: {
    mode?: "single" | "bulk";
    domains?: Array<"technical" | "legal" | "security">;
    modifiers?: PromptModifier[];
  }
): string {
  const parts: string[] = [];

  // Add blocks in order
  for (const blockId of composition.blockIds) {
    const block = blocks.find(b => b.id === blockId);
    if (!block) continue;

    // Use context-specific variant if available, otherwise default
    const content = block.variants[composition.context] ?? block.variants.default;
    if (content.trim()) {
      parts.push(`## ${block.name}\n${content}`);
    }
  }

  // Add mode modifier if applicable
  if (composition.supportsModes && options?.mode && options?.modifiers) {
    const modeModifier = options.modifiers.find(m => m.id === `mode_${options.mode}`);
    if (modeModifier) {
      parts.push(`## ${modeModifier.name}\n${modeModifier.content}`);
    }
  }

  // Add domain modifiers if applicable
  if (composition.supportsDomains && options?.domains && options?.modifiers) {
    for (const domain of options.domains) {
      const domainModifier = options.modifiers.find(m => m.id === `domain_${domain}`);
      if (domainModifier) {
        parts.push(`## ${domainModifier.name}\n${domainModifier.content}`);
      }
    }
  }

  return parts.join("\n\n");
}

/**
 * Get the prompt for a specific context with default blocks
 */
export function getDefaultPrompt(
  context: PromptContext,
  options?: {
    mode?: "single" | "bulk";
    domains?: Array<"technical" | "legal" | "security">;
  }
): string {
  const composition = defaultCompositions.find(c => c.context === context);
  if (!composition) {
    return "You are a helpful assistant.";
  }

  return buildPromptFromBlocks(defaultBlocks, composition, {
    ...options,
    modifiers: defaultModifiers,
  });
}
