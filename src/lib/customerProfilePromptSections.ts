import { PromptSectionConfig } from "./promptSections";

// Customer Profile extraction prompt sections (The Rolodex)
export const defaultCustomerProfileSections: PromptSectionConfig[] = [
  {
    id: "profile_role",
    title: "Your Role",
    description: "Define what you are extracting and why.",
    defaultText: [
      "You are creating a customer profile document from publicly available information about a company.",
      "This profile will be used to provide context when responding to RFPs, security questionnaires, and sales conversations for this customer.",
      "Extract accurate, factual information that helps understand the customer's business, needs, and context.",
      "Think of yourself as a research analyst preparing a briefing document.",
    ].join("\n"),
  },
  {
    id: "profile_structure",
    title: "Profile Format",
    description: "The JSON structure to return.",
    defaultText: [
      "Return a single JSON object with this structure:",
      "{",
      '  "name": string (official company name),',
      '  "industry": string (primary industry, e.g., "Healthcare", "Financial Services", "Technology"),',
      '  "website": string (primary company website URL),',
      '  "overview": string (2-4 paragraph company overview - see Overview Guidelines below),',
      '  "products": string (description of main products/services),',
      '  "challenges": string (known business challenges, pain points, or focus areas),',
      '  "keyFacts": [{ "label": string, "value": string }] (structured facts like Founded, Employees, Revenue, HQ),',
      '  "tags": string[] (3-8 relevant keywords for categorization, lowercase)',
      "}",
      "",
      "Return ONLY the JSON object - no markdown code fences, no explanatory text before or after.",
    ].join("\n"),
  },
  {
    id: "profile_overview",
    title: "Overview Guidelines",
    description: "How to write the company overview.",
    defaultText: [
      "The 'overview' field should provide a comprehensive but concise company summary:",
      "",
      "## Include",
      "- What the company does (core business)",
      "- Target market and customer base",
      "- Market position and competitive landscape",
      "- Brief history if relevant (founding, growth milestones)",
      "- Geographic presence and scale",
      "- Recent news, funding, or strategic initiatives",
      "",
      "## Writing Style",
      "- Write in clear, professional prose",
      "- Be factual - cite specific details from sources",
      "- Use 2-4 paragraphs, not bullet points",
      "- Avoid marketing superlatives and hyperbole",
      "- Write as an objective third-party observer",
    ].join("\n"),
  },
  {
    id: "profile_challenges",
    title: "Challenges & Needs",
    description: "What pain points and needs to identify.",
    defaultText: [
      "For the 'challenges' field, identify:",
      "",
      "- Industry-specific challenges (regulatory, competitive, technical)",
      "- Stated priorities from press releases, earnings calls, or job postings",
      "- Technology transformation initiatives",
      "- Security or compliance requirements implied by their industry",
      "- Growth challenges (scaling, geographic expansion, M&A integration)",
      "",
      "If challenges aren't explicitly stated, you may infer based on:",
      "- Industry norms (e.g., healthcare → HIPAA compliance)",
      "- Company stage (e.g., startup → scaling challenges)",
      "- Recent news (e.g., acquisition → integration challenges)",
      "",
      "Mark inferences clearly: 'Based on their industry, they likely need...'",
    ].join("\n"),
  },
  {
    id: "profile_key_facts",
    title: "Key Facts to Extract",
    description: "Which structured facts to capture.",
    defaultText: [
      "Extract the following into the 'keyFacts' array when available:",
      "",
      "| Label | Example Value |",
      "|-------|---------------|",
      "| Founded | 2015 |",
      "| Headquarters | San Francisco, CA |",
      "| Employees | 500-1000 |",
      "| Revenue | $50M ARR (or funding stage) |",
      "| Customers | 1000+ enterprise customers |",
      "| Industry | Financial Services |",
      "| Certifications | SOC 2, ISO 27001, HIPAA |",
      "| Tech Stack | AWS, React, Node.js |",
      "",
      "Only include facts you find in the source material.",
      "Use ranges when exact numbers aren't available (e.g., '500-1000').",
      "If the company is private and revenue isn't public, note funding stage instead.",
    ].join("\n"),
  },
  {
    id: "profile_guidelines",
    title: "Extraction Guidelines",
    description: "What to include and exclude.",
    defaultText: [
      "## INCLUDE",
      "- Company background and history",
      "- Primary products and services",
      "- Target market and customer base",
      "- Industry certifications or compliance requirements",
      "- Recent news, funding, or strategic initiatives",
      "- Known technology stack or infrastructure",
      "- Size indicators (employees, revenue, customers)",
      "- Geographic presence",
      "",
      "## EXCLUDE",
      "- Personal information about individuals (names, emails)",
      "- Speculation not supported by sources",
      "- Marketing superlatives without substance",
      "- Competitive positioning statements",
      "- Pricing information",
      "- Confidential or non-public information",
    ].join("\n"),
  },
];

// Editable customer profile section type
export type EditableCustomerProfileSection = PromptSectionConfig & {
  enabled: boolean;
  text: string;
};

// Build the customer profile prompt from sections
export const buildCustomerProfilePromptFromSections = (
  sections: EditableCustomerProfileSection[]
): string => {
  return sections
    .filter((s) => s.enabled && s.text.trim())
    .map((s) => s.text)
    .join("\n\n");
};

// Storage key for customer profile prompt sections
export const CUSTOMER_PROFILE_PROMPT_SECTIONS_KEY =
  "transparent-trust-customer-profile-sections";

// Load saved sections or return defaults
export const loadCustomerProfileSections =
  (): EditableCustomerProfileSection[] => {
    if (typeof window === "undefined") {
      return defaultCustomerProfileSections.map((s) => ({
        ...s,
        enabled: true,
        text: s.defaultText,
      }));
    }

    try {
      const saved = window.localStorage.getItem(
        CUSTOMER_PROFILE_PROMPT_SECTIONS_KEY
      );
      if (saved) {
        return JSON.parse(saved) as EditableCustomerProfileSection[];
      }
    } catch {
      // Ignore parse errors
    }

    return defaultCustomerProfileSections.map((s) => ({
      ...s,
      enabled: true,
      text: s.defaultText,
    }));
  };

// Save sections to localStorage
export const saveCustomerProfileSections = (
  sections: EditableCustomerProfileSection[]
): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CUSTOMER_PROFILE_PROMPT_SECTIONS_KEY,
    JSON.stringify(sections)
  );
};
