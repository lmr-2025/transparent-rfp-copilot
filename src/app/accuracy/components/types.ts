// Re-export question log types for convenience
export type {
  QuestionLogEntry,
  QuestionLogStats,
  QuestionLogStatus,
  QuestionLogSource,
  Pagination,
} from "@/app/admin/question-log/types";
export { statusConfig } from "@/app/admin/question-log/types";

// Tab types
export type TabId = "dashboard" | "questions" | "contracts" | "rfps";

// Accuracy dashboard data
export type AccuracyData = {
  summary: {
    totalAnswers: number;
    totalCorrected: number;
    overallAccuracy: number | null;
    flaggedCount: number;
    reviewsPending: number;
    reviewsApproved: number;
    reviewsCorrected: number;
  };
  confidenceDistribution: {
    High: number;
    Medium: number;
    Low: number;
    Unknown: number;
  };
  correctionRates: {
    confidence: string;
    total: number;
    corrected: number;
    correctionRate: number | null;
  }[];
  skillsNeedingAttention: {
    skillId: string;
    title: string;
    corrections: number;
    total: number;
    correctionRate: number;
  }[];
  daily: {
    date: string;
    high: number;
    medium: number;
    low: number;
    corrected: number;
    total: number;
    accuracyRate: number | null;
  }[];
  recentCorrections: {
    id: string;
    question: string;
    response: string;
    userEditedAnswer: string | null;
    confidence: string | null;
    usedSkills: { id: string; title: string }[] | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    project: { id: string; name: string } | null;
    source?: "project" | "questions";
  }[];
  period: { days: number; startDate: string };
};

// Contract feedback types
export type ContractFeedbackItem = {
  id: string;
  category: string;
  clauseText: string;
  feedbackType: "ai_missed" | "response_edited" | "rating_changed" | "rationale_changed";
  original?: string;
  corrected?: string;
  context?: string;
};

export type ContractFeedbackData = {
  contractId: string;
  contractName: string;
  customerName?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  stats: {
    totalFindings: number;
    aiGenerated: number;
    manuallyAdded: number;
    responsesEdited: number;
    ratingsChanged: number;
    rationalesChanged: number;
  };
  feedback: ContractFeedbackItem[];
};

// RFP feedback types
export type RFPFeedbackItem = {
  id: string;
  rowNumber: number;
  question: string;
  feedbackType: "response_edited" | "confidence_changed";
  original?: string;
  corrected?: string;
  originalConfidence?: string;
  newConfidence?: string;
};

export type RFPFeedbackData = {
  projectId: string;
  projectName: string;
  customerName?: string;
  stats: {
    totalRows: number;
    completedRows: number;
    editedResponses: number;
    reviewedRows: number;
    flaggedRows: number;
  };
  feedback: RFPFeedbackItem[];
};
