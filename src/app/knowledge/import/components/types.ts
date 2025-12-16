export type RFPEntry = {
  question: string;
  answer: string;
  source?: string;
};

export type SkillSuggestion = {
  type: "update" | "new";
  skillId?: string;
  skillTitle: string;
  currentContent?: string;
  suggestedAdditions: string;
  relevantQA: RFPEntry[];
  tags: string[];
};

export type AnalysisResult = {
  suggestions: SkillSuggestion[];
  unmatchedEntries: RFPEntry[];
};

export const styles = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  button: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
};
