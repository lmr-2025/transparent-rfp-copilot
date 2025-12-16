"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

export type FlagReviewAction = "flag" | "need-help";
export type SendTiming = "now" | "later";

export interface FlagReviewData {
  action: FlagReviewAction;
  sendTiming: SendTiming;
  reviewerId?: string;
  reviewerName?: string;
  note: string;
}

interface FlagReviewModalProps {
  isOpen: boolean;
  initialAction?: FlagReviewAction;
  onSubmit: (data: FlagReviewData) => void;
  onCancel: () => void;
  /** Whether this is being used for batch operations (shows "Queue for End" option) */
  allowQueueing?: boolean;
  /** Number of items queued for review (shown in badge) */
  queuedCount?: number;
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
    maxWidth: "520px",
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
    minHeight: "80px",
    resize: "vertical" as const,
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    flexWrap: "wrap" as const,
  },
  button: {
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    border: "none",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },
  sendNowButton: {
    backgroundColor: "#0ea5e9",
    color: "#fff",
  },
  queueButton: {
    backgroundColor: "#8b5cf6",
    color: "#fff",
  },
  flagButton: {
    backgroundColor: "#f59e0b",
    color: "#fff",
  },
  hint: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "-12px",
    marginBottom: "16px",
  },
  actionTabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "20px",
  },
  tab: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "8px",
    border: "2px solid #e2e8f0",
    backgroundColor: "#fff",
    cursor: "pointer",
    textAlign: "center" as const,
    transition: "all 0.15s ease",
  },
  tabActive: {
    borderColor: "#0ea5e9",
    backgroundColor: "#f0f9ff",
  },
  tabIcon: {
    fontSize: "20px",
    marginBottom: "4px",
    display: "block",
  },
  tabLabel: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#1e293b",
  },
  tabDescription: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "2px",
  },
  queueBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8b5cf6",
    color: "#fff",
    borderRadius: "12px",
    padding: "2px 8px",
    fontSize: "12px",
    fontWeight: 600,
    marginLeft: "8px",
  },
};

export default function FlagReviewModal({
  isOpen,
  initialAction = "need-help",
  onSubmit,
  onCancel,
  allowQueueing = true,
  queuedCount = 0,
}: FlagReviewModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [action, setAction] = useState<FlagReviewAction>(initialAction);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [note, setNote] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAction(initialAction);
      setSelectedUserId("");
      setNote("");

      // Fetch users for "need-help" action
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

      // Focus textarea after a small delay
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, initialAction]);

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

  const handleSubmit = (sendTiming: SendTiming) => {
    const selectedUser = users.find((u) => u.id === selectedUserId);
    onSubmit({
      action,
      sendTiming,
      reviewerId: action === "need-help" ? (selectedUserId || undefined) : undefined,
      reviewerName: action === "need-help" && selectedUser
        ? (selectedUser.name || selectedUser.email || undefined)
        : undefined,
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
      aria-labelledby="flag-review-modal-title"
    >
      <div style={styles.modal}>
        <h2 id="flag-review-modal-title" style={styles.title}>
          Flag or Request Review
        </h2>
        <p style={styles.subtitle}>
          Mark this answer for attention or get help from a colleague.
        </p>

        {/* Action Tabs */}
        <div style={styles.actionTabs}>
          <button
            type="button"
            onClick={() => setAction("flag")}
            style={{
              ...styles.tab,
              ...(action === "flag" ? styles.tabActive : {}),
            }}
          >
            <span style={styles.tabIcon}>🚩</span>
            <span style={styles.tabLabel}>Flag</span>
            <span style={styles.tabDescription}>Mark for your attention</span>
          </button>
          <button
            type="button"
            onClick={() => setAction("need-help")}
            style={{
              ...styles.tab,
              ...(action === "need-help" ? styles.tabActive : {}),
            }}
          >
            <span style={styles.tabIcon}>🤚</span>
            <span style={styles.tabLabel}>Need Help?</span>
            <span style={styles.tabDescription}>Request a review</span>
          </button>
        </div>

        {/* Reviewer selection - only for "need-help" */}
        {action === "need-help" && (
          <>
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
          </>
        )}

        {/* Note input */}
        <label style={styles.label}>
          {action === "flag" ? "Note (optional)" : "Note for reviewer (optional)"}
        </label>
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            action === "flag"
              ? "e.g., 'Need to verify compliance claim' or 'Check with legal'"
              : "e.g., 'Please verify the SOC 2 claims' or 'Not sure about this'"
          }
          style={styles.textarea}
        />

        {/* Action buttons */}
        <div style={styles.buttonRow}>
          <button
            onClick={onCancel}
            style={{ ...styles.button, ...styles.cancelButton }}
          >
            Cancel
          </button>

          {/* Queue for End - only available for "need-help" action (flags are instant, not queueable) */}
          {allowQueueing && action === "need-help" && (
            <button
              onClick={() => handleSubmit("later")}
              style={{ ...styles.button, ...styles.queueButton }}
            >
              Queue for End
              {queuedCount > 0 && (
                <span style={styles.queueBadge}>{queuedCount}</span>
              )}
            </button>
          )}

          <button
            onClick={() => handleSubmit("now")}
            style={{
              ...styles.button,
              ...(action === "flag" ? styles.flagButton : styles.sendNowButton),
            }}
          >
            {action === "flag" ? "Flag Now" : "Send Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
interface UseFlagReviewReturn {
  openFlagReview: (initialAction?: FlagReviewAction) => Promise<FlagReviewData | null>;
  FlagReviewDialog: React.FC;
  queuedItems: FlagReviewQueueItem[];
  addToQueue: (item: FlagReviewQueueItem) => void;
  clearQueue: () => void;
  processQueue: () => FlagReviewQueueItem[];
}

export interface FlagReviewQueueItem {
  id: string;
  data: FlagReviewData;
}

export function useFlagReview(): UseFlagReviewReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [initialAction, setInitialAction] = useState<FlagReviewAction>("need-help");
  const [queuedItems, setQueuedItems] = useState<FlagReviewQueueItem[]>([]);
  const resolveRef = useRef<((value: FlagReviewData | null) => void) | null>(null);

  const openFlagReview = useCallback(
    (action: FlagReviewAction = "need-help"): Promise<FlagReviewData | null> => {
      setInitialAction(action);
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    []
  );

  const handleSubmit = useCallback(
    (data: FlagReviewData) => {
      setIsOpen(false);
      resolveRef.current?.(data);
    },
    []
  );

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(null);
  }, []);

  const addToQueue = useCallback((item: FlagReviewQueueItem) => {
    setQueuedItems((prev) => [...prev, item]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueuedItems([]);
  }, []);

  const processQueue = useCallback(() => {
    const items = [...queuedItems];
    setQueuedItems([]);
    return items;
  }, [queuedItems]);

  const FlagReviewDialog: React.FC = useCallback(
    () => (
      <FlagReviewModal
        isOpen={isOpen}
        initialAction={initialAction}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        allowQueueing={true}
        queuedCount={queuedItems.length}
      />
    ),
    [isOpen, initialAction, handleSubmit, handleCancel, queuedItems.length]
  );

  return {
    openFlagReview,
    FlagReviewDialog,
    queuedItems,
    addToQueue,
    clearQueue,
    processQueue,
  };
}
