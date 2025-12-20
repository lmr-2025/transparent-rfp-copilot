"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Flag or Request Review</DialogTitle>
          <DialogDescription>
            Mark this answer for attention or get help from a colleague.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Action Tabs */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction("flag")}
              className={cn(
                "flex-1 p-3 rounded-lg border-2 bg-white cursor-pointer text-center transition-all",
                action === "flag"
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-200"
              )}
            >
              <span className="text-xl mb-1 block">🚩</span>
              <span className="text-sm font-medium text-slate-800">Flag</span>
              <span className="text-xs text-slate-500 mt-0.5 block">Mark for your attention</span>
            </button>
            <button
              type="button"
              onClick={() => setAction("need-help")}
              className={cn(
                "flex-1 p-3 rounded-lg border-2 bg-white cursor-pointer text-center transition-all",
                action === "need-help"
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-200"
              )}
            >
              <span className="text-xl mb-1 block">🤚</span>
              <span className="text-sm font-medium text-slate-800">Need Help?</span>
              <span className="text-xs text-slate-500 mt-0.5 block">Request a review</span>
            </button>
          </div>

          {/* Reviewer selection - only for "need-help" */}
          {action === "need-help" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Assign to reviewer (optional)
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={loadingUsers}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="">Anyone can review</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email || "Unknown user"}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">
                Leave blank to allow anyone to review, or select a specific person.
              </p>
            </div>
          )}

          {/* Note input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg min-h-[80px] resize-y font-inherit leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Action buttons */}
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          {/* Queue for End - only available for "need-help" action (flags are instant, not queueable) */}
          {allowQueueing && action === "need-help" && (
            <Button
              onClick={() => handleSubmit("later")}
              className="bg-violet-500 hover:bg-violet-600"
            >
              Queue for End
              {queuedCount > 0 && (
                <span className="inline-flex items-center justify-center bg-violet-400 text-white rounded-full px-2 py-0.5 text-xs font-semibold ml-2">
                  {queuedCount}
                </span>
              )}
            </Button>
          )}

          <Button
            onClick={() => handleSubmit("now")}
            className={action === "flag" ? "bg-amber-500 hover:bg-amber-600" : "bg-sky-500 hover:bg-sky-600"}
          >
            {action === "flag" ? "Flag Now" : "Send Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
