import { Skill } from "./skill";

export type BulkRow = {
  id: string;
  rowNumber: number;
  cells: Record<string, string>;
  question: string;
  response: string;
  status: "pending" | "generating" | "completed" | "error";
  error?: string;
  challengePrompt: string;
  challengeResponse?: string;
  challengeStatus?: "idle" | "generating" | "completed" | "error";
  challengeError?: string;
  conversationOpen?: boolean; // Track if conversation UI is open for this row
  // Structured response sections
  confidence?: string;
  sources?: string;
  remarks?: string;
  // Skill integration
  usedSkills?: Skill[];
  showRecommendation?: boolean; // Track if skill recommendation should be shown
  // Selection for bulk operations
  selected?: boolean; // Track if row should be included in bulk generation
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
};
