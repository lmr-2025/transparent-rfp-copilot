// Simple prompt section config type
export type PromptSectionConfig = {
  id: string;
  title: string;
  description: string;
  defaultText: string;
};

// Contract Analysis prompt sections
export const defaultContractAnalysisSections: PromptSectionConfig[] = [
  {
    id: "analysis_role",
    title: "Your Role",
    description: "Define the analysis persona and context.",
    defaultText: [
      "You are a security and compliance expert reviewing customer contracts.",
      "Your task is to analyze security-related clauses and assess whether the organization can meet the requirements based on their documented capabilities.",
    ].join("\n"),
  },
  {
    id: "analysis_categories",
    title: "Analysis Categories",
    description: "The categories used to classify contract clauses.",
    defaultText: [
      "ANALYSIS CATEGORIES:",
      "- data_protection: Data handling, privacy, GDPR, personal data requirements",
      "- security_controls: Technical security measures, encryption, access controls",
      "- certifications: SOC 2, ISO 27001, PCI DSS, HIPAA compliance requirements",
      "- incident_response: Breach notification, incident handling, response times",
      "- audit_rights: Customer audit rights, third-party assessments, penetration testing",
      "- subprocessors: Third-party/subcontractor requirements and approvals",
      "- data_retention: Data storage duration, deletion requirements",
      "- insurance: Cyber liability, professional liability coverage requirements",
      "- liability: Limitation of liability, indemnification related to security",
      "- confidentiality: NDA terms, information handling",
      "- other: Other security or compliance related items",
    ].join("\n"),
  },
  {
    id: "analysis_ratings",
    title: "Rating Scale",
    description: "How to rate each clause finding.",
    defaultText: [
      "RATING SCALE:",
      "- can_comply: The organization fully meets this requirement based on their documented capabilities",
      "- partial: The organization partially meets this; may need adjustments or clarification",
      "- gap: The organization does not currently support this requirement",
      "- risk: This clause poses a potential risk or unreasonable obligation",
      "- info_only: Informational clause, no specific action needed",
    ].join("\n"),
  },
  {
    id: "analysis_output",
    title: "Output Format",
    description: "The JSON structure for analysis results.",
    defaultText: [
      "OUTPUT FORMAT:",
      "Return a JSON object with this exact structure:",
      "{",
      '  "overallRating": "compliant" | "mostly_compliant" | "needs_review" | "high_risk",',
      '  "summary": "Executive summary of the contract analysis (2-3 paragraphs)",',
      '  "findings": [',
      "    {",
      '      "category": "category_name",',
      '      "clauseText": "The exact or summarized clause text from the contract",',
      '      "rating": "can_comply" | "partial" | "gap" | "risk" | "info_only",',
      '      "rationale": "Why this rating was given, referencing your capabilities",',
      '      "suggestedResponse": "Optional: How to respond or negotiate if needed"',
      "    }",
      "  ]",
      "}",
    ].join("\n"),
  },
  {
    id: "analysis_guidelines",
    title: "Analysis Guidelines",
    description: "Rules for conducting the analysis.",
    defaultText: [
      "GUIDELINES:",
      "1. Focus on security, privacy, and compliance clauses",
      "2. Extract 5-20 key findings (don't list every clause, focus on important ones)",
      "3. Be specific about which of your capabilities support each finding",
      "4. For gaps or risks, suggest concrete responses or negotiation points",
      "5. The overall rating should reflect the aggregate risk level",
      "6. Return ONLY valid JSON, no markdown or explanatory text",
    ].join("\n"),
  },
];

// Editable contract analysis section type
export type EditableContractAnalysisSection = PromptSectionConfig & {
  enabled: boolean;
  text: string;
};

// Build the contract analysis prompt from sections
export const buildContractAnalysisPromptFromSections = (
  sections: EditableContractAnalysisSection[]
): string => {
  return sections
    .filter((s) => s.enabled && s.text.trim())
    .map((s) => s.text)
    .join("\n\n");
};

// Storage key for contract analysis prompt sections
export const CONTRACT_ANALYSIS_PROMPT_SECTIONS_KEY =
  "transparent-trust-contract-analysis-sections";

// Load saved sections or return defaults
export const loadContractAnalysisSections =
  (): EditableContractAnalysisSection[] => {
    if (typeof window === "undefined") {
      return defaultContractAnalysisSections.map((s) => ({
        ...s,
        enabled: true,
        text: s.defaultText,
      }));
    }

    try {
      const saved = window.localStorage.getItem(
        CONTRACT_ANALYSIS_PROMPT_SECTIONS_KEY
      );
      if (saved) {
        return JSON.parse(saved) as EditableContractAnalysisSection[];
      }
    } catch {
      // Ignore parse errors
    }

    return defaultContractAnalysisSections.map((s) => ({
      ...s,
      enabled: true,
      text: s.defaultText,
    }));
  };

// Save sections to localStorage
export const saveContractAnalysisSections = (
  sections: EditableContractAnalysisSection[]
): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CONTRACT_ANALYSIS_PROMPT_SECTIONS_KEY,
    JSON.stringify(sections)
  );
};
