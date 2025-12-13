export type BulkRow = {
  id: string;
  rowNumber: number;
  question: string;
  response: string;
  status: "pending" | "generating" | "completed" | "error";
  error?: string;
  sourceTab?: string; // Which Excel tab this row came from (for multi-tab uploads)
  conversationHistory?: { role: string; content: string }[];
  confidence?: string;
  sources?: string;
  reasoning?: string; // What skills matched and what was found directly
  inference?: string; // What was inferred/deduced, or "None" if everything was found directly
  remarks?: string;
  usedSkills?: (string | { id: string; title: string })[]; // Can be Skill objects or string IDs
  usedFallback?: boolean; // True if answer was generated from reference URLs instead of skills
  showRecommendation?: boolean;
  // Review flagging
  flaggedForReview?: boolean;
  flaggedAt?: string;
  flaggedBy?: string;
  flagNote?: string;
  // Legacy fields for conversational refinement
  challengePrompt?: string;
  challengeResponse?: string;
  challengeStatus?: string;
  challengeError?: string;
  conversationOpen?: boolean;
  selected?: boolean;
  detailsExpanded?: boolean; // Toggle for showing reasoning/inference/remarks/sources
};

// Simplified customer profile reference for projects
export type ProjectCustomerProfileRef = {
  id: string;
  name: string;
  industry?: string;
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
  // Linked customer profiles
  customerProfiles?: ProjectCustomerProfileRef[];
};
