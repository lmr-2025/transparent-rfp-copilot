"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

interface RequestReviewModalProps {
  isOpen: boolean;
  onSubmit: (data: { reviewerId?: string; reviewerName?: string; note: string }) => void;
  onCancel: () => void;
}

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "500px",
    width: "90%",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  },
  title: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: "20px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "6px",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    marginBottom: "16px",
    outline: "none",
    backgroundColor: "#fff",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    marginBottom: "20px",
    outline: "none",
    minHeight: "100px",
    resize: "vertical" as const,
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },
  submitButton: {
    backgroundColor: "#0ea5e9",
    color: "#fff",
    border: "none",
  },
  hint: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "-12px",
    marginBottom: "16px",
  },
};

export default function RequestReviewModal({
  isOpen,
  onSubmit,
  onCancel,
}: RequestReviewModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [note, setNote] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch users when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingUsers(true);
      fetch("/api/users")
        .then((res) => res.json())
        .then((data) => {
          setUsers(data.users || []);
        })
        .catch(() => {
          // Silent failure - users list is optional
        })
        .finally(() => {
          setLoadingUsers(false);
        });

      // Reset form
      setSelectedUserId("");
      setNote("");

      // Focus textarea after a small delay
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleSubmit = () => {
    const selectedUser = users.find((u) => u.id === selectedUserId);
    onSubmit({
      reviewerId: selectedUserId || undefined,
      reviewerName: selectedUser ? (selectedUser.name || selectedUser.email || undefined) : undefined,
      note: note.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div style={styles.modal}>
        <h2 id="review-modal-title" style={styles.title}>
          Request Review
        </h2>
        <p style={styles.subtitle}>
          Send this answer for review. The reviewer will be notified and can approve or correct the answer.
        </p>

        <label style={styles.label}>Assign to reviewer (optional)</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={styles.select}
          disabled={loadingUsers}
        >
          <option value="">Anyone can review</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name || user.email || "Unknown user"}
            </option>
          ))}
        </select>
        <p style={styles.hint}>
          Leave blank to allow anyone to review, or select a specific person.
        </p>

        <label style={styles.label}>Note for reviewer (optional)</label>
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., 'Please verify the compliance claims' or 'Not sure about the SOC 2 mention'"
          style={styles.textarea}
        />

        <div style={styles.buttonRow}>
          <button
            onClick={onCancel}
            style={{ ...styles.button, ...styles.cancelButton }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{ ...styles.button, ...styles.submitButton }}
          >
            Send for Review
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
interface UseRequestReviewReturn {
  requestReview: () => Promise<{ reviewerId?: string; reviewerName?: string; note: string } | null>;
  RequestReviewDialog: React.FC;
}

export function useRequestReview(): UseRequestReviewReturn {
  const [isOpen, setIsOpen] = useState(false);
  const resolveRef = useRef<((value: { reviewerId?: string; reviewerName?: string; note: string } | null) => void) | null>(null);

  const requestReview = useCallback(
    (): Promise<{ reviewerId?: string; reviewerName?: string; note: string } | null> => {
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    []
  );

  const handleSubmit = useCallback(
    (data: { reviewerId?: string; reviewerName?: string; note: string }) => {
      setIsOpen(false);
      resolveRef.current?.(data);
    },
    []
  );

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(null);
  }, []);

  const RequestReviewDialog: React.FC = useCallback(
    () => (
      <RequestReviewModal
        isOpen={isOpen}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    ),
    [isOpen, handleSubmit, handleCancel]
  );

  return { requestReview, RequestReviewDialog };
}
