export type InstructionPreset = {
  id: string;
  name: string;
  content: string;
  description: string | null;
  isShared: boolean;
  isDefault: boolean;
  shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByEmail: string | null;
  defaultCategories: string[]; // Auto-select skills in these categories when persona is chosen
};

export const statusColors = {
  PRIVATE: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" },
  PENDING_APPROVAL: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  APPROVED: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  REJECTED: { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" },
};

// Features that use personas
export const personaFeatures = [
  {
    id: "chat",
    name: "Knowledge Chat",
    description: "AI-powered Q&A using your knowledge base",
    howUsed: "Selected in the chat interface to customize AI behavior and response style",
  },
  {
    id: "collateral",
    name: "Collateral Builder",
    description: "Generate sales decks, one-pagers, and documents",
    howUsed: "Templates can auto-select a persona, or users choose one to set the tone for generated content",
  },
];

export const STARTER_TEMPLATES = [
  {
    id: "security",
    label: "Security & Compliance Expert",
    description: "For sales calls, security questionnaires",
    prompt: "I want to create a Security & Compliance Expert assistant that helps our sales team answer customer security questions during calls. It should know about our security posture, certifications, and compliance frameworks.",
  },
  {
    id: "sales",
    label: "Sales Support Assistant",
    description: "Product knowledge, objection handling",
    prompt: "I want to create a Sales Support Assistant that helps our team with product knowledge, feature explanations, and handling common objections during customer conversations.",
  },
  {
    id: "technical",
    label: "Technical Documentation Writer",
    description: "Clear explanations, documentation style",
    prompt: "I want to create a Technical Documentation Writer assistant that helps create clear, well-structured technical documentation and explanations for our products.",
  },
];
