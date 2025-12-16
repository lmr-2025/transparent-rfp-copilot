"use client";

import { History, Clock, User, FileText, RefreshCw, Plus, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HistoryEntry, UnifiedLibraryItem } from "@/hooks/use-knowledge-data";
import { cn } from "@/lib/utils";

interface SkillHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UnifiedLibraryItem;
}

function getActionIcon(action: string) {
  switch (action) {
    case "created":
      return <Plus className="h-4 w-4" />;
    case "updated":
      return <Edit className="h-4 w-4" />;
    case "refreshed":
      return <RefreshCw className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getActionColor(action: string) {
  switch (action) {
    case "created":
      return "text-green-600 bg-green-100";
    case "updated":
      return "text-blue-600 bg-blue-100";
    case "refreshed":
      return "text-amber-600 bg-amber-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

export function SkillHistoryDialog({
  open,
  onOpenChange,
  item,
}: SkillHistoryDialogProps) {
  const history = (item.history || []) as HistoryEntry[];
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            History for &ldquo;{item.title}&rdquo;
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {sortedHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No history recorded for this skill.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <ul className="space-y-4">
                {sortedHistory.map((entry, i) => (
                  <li key={i} className="relative pl-10">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center",
                        getActionColor(entry.action)
                      )}
                    >
                      {getActionIcon(entry.action)}
                    </div>

                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm capitalize">
                          {entry.action}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.date).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {entry.summary}
                      </p>
                      {entry.user && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {entry.user}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Created date footer */}
        <div className="pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              Skill created: {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>
          {item.lastRefreshedAt && (
            <div className="flex items-center gap-2 mt-1">
              <RefreshCw className="h-4 w-4" />
              <span>
                Last refreshed: {new Date(item.lastRefreshedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
