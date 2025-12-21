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
      "You are a legal and security expert reviewing customer contracts.",
      "Your task is to analyze both LEGAL and SECURITY clauses, identifying risks, obligations, and areas requiring negotiation.",
      "Focus on protecting the vendor's interests while ensuring reasonable compliance.",
    ].join("\n"),
  },
  {
    id: "analysis_categories",
    title: "Analysis Categories",
    description: "The categories used to classify contract clauses.",
    defaultText: [
      "ANALYSIS CATEGORIES:",
      "",
      "SECURITY CATEGORIES:",
      "- data_protection: Data handling, privacy, GDPR, personal data requirements",
      "- security_controls: Technical security measures, access controls, monitoring",
      "- certifications: SOC 2, ISO 27001, PCI DSS, HIPAA compliance requirements",
      "- incident_response: Breach notification, incident handling, response times",
      "- vulnerability_management: Patching timelines, vulnerability scanning requirements",
      "- access_control: User access, authentication, authorization requirements",
      "- encryption: Data encryption at rest and in transit requirements",
      "- penetration_testing: Pen test requirements, frequency, remediation timelines",
      "",
      "LEGAL CATEGORIES:",
      "- liability: General liability provisions and caps",
      "- indemnification: Who indemnifies whom, scope of indemnification",
      "- limitation_of_liability: Liability caps, exclusions, carve-outs",
      "- insurance: Cyber liability, E&O, professional liability coverage amounts",
      "- termination: Termination rights, notice periods, termination for cause/convenience",
      "- intellectual_property: IP ownership, licenses, work product rights",
      "- warranties: Service warranties, disclaimers, representations",
      "- governing_law: Jurisdiction, venue, dispute resolution",
      "",
      "COMPLIANCE CATEGORIES:",
      "- audit_rights: Customer audit rights, third-party assessments, frequency",
      "- subprocessors: Third-party/subcontractor requirements, approval rights",
      "- data_retention: Data storage duration, deletion requirements, return of data",
      "- confidentiality: NDA terms, information handling, survival periods",
      "- regulatory_compliance: Industry-specific compliance (HIPAA, PCI, etc.)",
      "",
      "GENERAL CATEGORIES:",
      "- sla_performance: Uptime commitments, credits, performance metrics",
      "- payment_terms: Payment timing, late fees, price increases",
      "- other: Other notable clauses",
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
      "1. Analyze BOTH legal and security clauses comprehensively",
      "2. Extract 10-25 key findings covering both domains",
      "3. Prioritize findings that pose risk or require negotiation",
      "4. For legal clauses: identify unfavorable terms, unlimited liability, broad indemnification",
      "5. For security clauses: compare against documented capabilities",
      "6. Suggest specific redline language or negotiation points for risks/gaps",
      "7. The overall rating should reflect aggregate legal AND security risk",
      "8. Return ONLY valid JSON, no markdown or explanatory text",
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
