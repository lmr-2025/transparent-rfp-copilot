export type QuestionLogStatus = "answered" | "verified" | "corrected" | "locked" | "resolved" | "pending";

export type QuestionLogSource = "project" | "questions";

export type QuestionLogEntry = {
  id: string;
  source: QuestionLogSource;
  projectId?: string;
  projectName?: string;
  customerName?: string; // Customer/company name from project
  question: string;
  response: string;
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
  status: QuestionLogStatus;
  // Who asked/created (for org-wide tracking)
  askedById?: string; // User ID for filtering
  askedBy?: string; // Display name
  askedByEmail?: string;
  // Who finalized (reviewed/resolved)
  finalizedById?: string;
  finalizedBy?: string;
  finalizedByEmail?: string;
  // Timestamps
  finalizedAt: string;
  createdAt: string;
  // Additional metadata
  reviewRequestedBy?: string;
  reviewRequestedAt?: string;
  flaggedBy?: string;
  flaggedAt?: string;
  flagNote?: string;
  flagResolutionNote?: string;
  userEditedAnswer?: string; // The corrected answer if edited
};

export type QuestionLogStats = {
  total: number;
  answered: number;
  verified: number;
  corrected: number;
  locked: number;
  resolved: number;
  pending: number;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type QuestionLogFilters = {
  search?: string;
  status?: QuestionLogStatus | "all";
  source?: QuestionLogSource | "all";
  dateFrom?: string;
  dateTo?: string;
};

// Status badge configuration
export const statusConfig: Record<QuestionLogStatus, { label: string; color: string; bgColor: string }> = {
  answered: { label: "Answered", color: "#0369a1", bgColor: "#e0f2fe" },
  verified: { label: "Verified", color: "#059669", bgColor: "#d1fae5" },
  corrected: { label: "Corrected", color: "#2563eb", bgColor: "#dbeafe" },
  locked: { label: "Locked", color: "#4b5563", bgColor: "#e5e7eb" },
  resolved: { label: "Resolved", color: "#d97706", bgColor: "#fef3c7" },
  pending: { label: "Pending", color: "#9ca3af", bgColor: "#f3f4f6" },
};

export const sourceConfig: Record<QuestionLogSource, { label: string }> = {
  project: { label: "Project" },
  questions: { label: "Quick Question" },
};
