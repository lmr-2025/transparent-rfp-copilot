// Shared types for chat components

export type TransparencyData = {
  systemPrompt: string;
  baseSystemPrompt: string;
  knowledgeContext: string;
  customerContext: string;
  documentContext: string;
  urlContext: string;
  model: string;
  maxTokens: number;
  temperature: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  skillsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  documentsUsed?: { id: string; title: string }[];
  urlsUsed?: { id: string; title: string }[];
  transparency?: TransparencyData;
};

export type SkillSelection = {
  id: string;
  title: string;
  selected: boolean;
  tags: string[];
  categories: string[];
};

export type CustomerSelection = {
  id: string;
  name: string;
  industry?: string;
  selected: boolean;
};

export type DocumentSelection = {
  id: string;
  title: string;
  filename: string;
  fileSize: number;
  categories: string[];
  selected: boolean;
  content?: string;
};

export type UrlSelection = {
  id: string;
  url: string;
  title: string;
  categories: string[];
  selected: boolean;
};

export type InstructionPreset = {
  id: string;
  name: string;
  content: string;
  description?: string;
  isShared: boolean;
  isDefault: boolean;
  shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  createdBy?: string;
  createdByEmail?: string;
};

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

export type ChatSessionItem = {
  id: string;
  title: string;
  messages: StoredMessage[];
  skillsUsed?: { id: string; title: string }[];
  documentsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  urlsUsed?: { id: string; title: string }[];
  createdAt: string;
  updatedAt: string;
};

export type SidebarTab = "instructions" | "prompts" | "knowledge" | "customers";
