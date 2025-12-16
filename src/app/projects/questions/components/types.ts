export type QuestionHistoryItem = {
  id: string;
  question: string;
  response: string;
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
  remarks?: string;
  skillsUsed?: { id: string; title: string }[];
  createdAt: string;
  reviewStatus?: string;
  reviewNote?: string;
  reviewRequestedBy?: string;
  reviewedBy?: string;
  flaggedForReview?: boolean;
  flagNote?: string;
};

export const formatHistoryDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};
