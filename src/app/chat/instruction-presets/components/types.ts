export type InstructionPreset = {
  id: string;
  name: string;
  content: string;
  description: string | null;
  isShared: boolean;
  isDefault: boolean;
  shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  shareRequestedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByEmail: string | null;
};

export const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    backgroundColor: "#fff",
  },
  button: {
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "13px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 500,
  },
};

export const statusColors = {
  PRIVATE: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" },
  PENDING_APPROVAL: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  APPROVED: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  REJECTED: { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" },
};

// Helper to insert snippet at cursor position
export const insertAtCursor = (
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  snippet: string,
  setValue: (value: string) => void,
  currentValue: string
) => {
  const textarea = textareaRef.current;
  if (!textarea) {
    setValue(currentValue + snippet);
    return;
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const newValue = currentValue.slice(0, start) + snippet + currentValue.slice(end);
  setValue(newValue);
  // Reset cursor position after React re-renders
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + snippet.length, start + snippet.length);
  }, 0);
};
