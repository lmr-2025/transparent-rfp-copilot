export type BulkRow = {
  id: string;
  rowNumber: number;
  question: string;
  response: string;
  status: "pending" | "generating" | "completed" | "error";
  error?: string;
  conversationHistory?: { role: string; content: string }[];
  confidence?: string;
  sources?: string;
  reasoning?: string; // What skills matched and what was found directly
  inference?: string; // What was inferred/deduced, or "None" if everything was found directly
  remarks?: string;
  usedSkills?: (string | { id: string; title: string })[]; // Can be Skill objects or string IDs
  showRecommendation?: boolean;
  // Legacy fields for conversational refinement
  challengePrompt?: string;
  challengeResponse?: string;
  challengeStatus?: string;
  challengeError?: string;
  conversationOpen?: boolean;
  selected?: boolean;
};

export type BulkProject = {
  id: string;
  name: string;
  sheetName: string;
  columns: string[];
  rows: BulkRow[];
  createdAt: string;
  lastModifiedAt: string;
  ownerName?: string;
  customerName?: string;
  status: "draft" | "in_progress" | "needs_review" | "approved";
  notes?: string;
  // Review workflow fields
  reviewRequestedAt?: string;
  reviewRequestedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};
