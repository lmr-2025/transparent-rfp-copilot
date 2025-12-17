import { statusInlineStyles } from "@/components/ui/status-display";

export const styles = {
  container: {
    maxWidth: "1200px",
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
  // Use shared status styles for consistency
  error: statusInlineStyles.error,
  success: statusInlineStyles.success,
};

export type SkillGroupStatus = "pending" | "approved" | "rejected" | "generating" | "saving" | "ready_for_review" | "reviewed" | "done" | "error";

export const getGroupStatusStyle = (status: SkillGroupStatus) => {
  switch (status) {
    case "approved": case "reviewed": case "done":
      return { backgroundColor: "#f0fdf4", borderColor: "#86efac" };
    case "rejected":
      return { backgroundColor: "#fef2f2", borderColor: "#fecaca" };
    case "generating": case "saving":
      return { backgroundColor: "#eff6ff", borderColor: "#93c5fd" };
    case "ready_for_review":
      return { backgroundColor: "#fefce8", borderColor: "#fde047" };
    case "error":
      return { backgroundColor: "#fef2f2", borderColor: "#fecaca" };
    default:
      return { backgroundColor: "#fff", borderColor: "#e2e8f0" };
  }
};
