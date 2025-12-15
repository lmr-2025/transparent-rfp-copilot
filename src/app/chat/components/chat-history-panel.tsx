"use client";

import { useState } from "react";
import { Trash2, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ConfirmModal";

export interface ChatSessionItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages?: { role: string; content: string; timestamp?: string }[];
  skillsUsed?: { id: string; title: string }[];
  documentsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  urlsUsed?: { id: string; title: string }[];
}

interface ChatHistoryPanelProps {
  sessions: ChatSessionItem[];
  currentSessionId: string | null;
  isLoading: boolean;
  onLoadSession: (session: ChatSessionItem) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
}

export function ChatHistoryPanel({
  sessions,
  currentSessionId,
  isLoading,
  onLoadSession,
  onDeleteSession,
  onClose,
}: ChatHistoryPanelProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm({
    title: "Delete Chat Session",
    message: "Are you sure you want to delete this chat session? This action cannot be undone.",
    variant: "danger",
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm();
    if (confirmed) {
      setDeletingId(id);
      onDeleteSession(id);
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getSessionPreview = (session: ChatSessionItem): string => {
    if (!session.messages || session.messages.length === 0) {
      return "Empty session";
    }
    const firstUserMessage = session.messages.find((m) => m.role === "user");
    if (firstUserMessage) {
      const content = firstUserMessage.content;
      return content.length > 60 ? content.substring(0, 60) + "..." : content;
    }
    return "No messages";
  };

  if (isLoading) {
    return (
      <Card className="absolute top-full left-0 right-0 z-50 mt-2 shadow-lg">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="absolute top-full left-0 right-0 z-50 mt-2 shadow-lg max-h-80 overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Chat History</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-64 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No chat history yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onLoadSession(session)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors",
                    currentSessionId === session.id && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{getSessionPreview(session)}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(session.updatedAt)}</span>
                        {session.messages && (
                          <span>• {session.messages.length} messages</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDelete(session.id, e)}
                    disabled={deletingId === session.id}
                  >
                    {deletingId === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog />
    </>
  );
}
