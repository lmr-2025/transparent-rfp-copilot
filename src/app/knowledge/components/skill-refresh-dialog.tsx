"use client";

import { useState, useMemo } from "react";
import { Check, X, RefreshCw, AlertCircle } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshResult } from "@/hooks/use-knowledge";
import { diffLines, Change } from "diff";

interface SkillRefreshDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillTitle: string;
  refreshResult: RefreshResult | null;
  isLoading: boolean;
  onApply: (title: string, content: string, changeHighlights?: string[]) => Promise<void>;
}

export function SkillRefreshDialog({
  open,
  onOpenChange,
  skillTitle,
  refreshResult,
  isLoading,
  onApply,
}: SkillRefreshDialogProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [viewMode, setViewMode] = useState<"diff" | "preview">("diff");

  // Compute diff when we have both original and new content
  const diffResult = useMemo(() => {
    if (!refreshResult?.hasChanges || !refreshResult.draft || !refreshResult.originalContent) {
      return null;
    }
    return diffLines(refreshResult.originalContent, refreshResult.draft.content);
  }, [refreshResult]);

  const handleApply = async () => {
    if (!refreshResult?.draft) return;
    setIsApplying(true);
    try {
      await onApply(
        refreshResult.draft.title,
        refreshResult.draft.content,
        refreshResult.draft.changeHighlights
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Refresh Skill: {skillTitle}
          </DialogTitle>
          <DialogDescription>
            Re-fetching content from source URLs to check for updates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <InlineLoader size="lg" className="text-blue-600" />
              <p className="text-muted-foreground">
                Fetching source URLs and comparing content...
              </p>
              <p className="text-sm text-muted-foreground">
                This may take 15-30 seconds.
              </p>
            </div>
          )}

          {!isLoading && refreshResult && !refreshResult.hasChanges && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-lg font-medium text-green-700">Skill is up to date!</p>
              <p className="text-muted-foreground text-center max-w-md">
                {refreshResult.message || "No new information found in the source URLs. The skill content is already current."}
              </p>
            </div>
          )}

          {!isLoading && refreshResult && refreshResult.hasChanges && refreshResult.draft && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Updates found!</p>
                  <p className="text-sm text-amber-700 mt-1">
                    {refreshResult.draft.summary}
                  </p>
                </div>
              </div>

              {refreshResult.draft.changeHighlights.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">What changed:</h4>
                  <ul className="space-y-1">
                    {refreshResult.draft.changeHighlights.map((highlight, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-green-600 font-bold">+</span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Content changes:</h4>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setViewMode("diff")}
                      className={`px-2 py-1 text-xs rounded ${viewMode === "diff" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      Diff
                    </button>
                    <button
                      onClick={() => setViewMode("preview")}
                      className={`px-2 py-1 text-xs rounded ${viewMode === "preview" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {viewMode === "diff" && diffResult ? (
                  <div className="bg-muted/30 p-3 rounded-lg max-h-80 overflow-y-auto font-mono text-xs">
                    {diffResult.map((part: Change, index: number) => (
                      <div
                        key={index}
                        className={`whitespace-pre-wrap ${
                          part.added
                            ? "bg-green-100 text-green-800 border-l-2 border-green-500 pl-2"
                            : part.removed
                            ? "bg-red-100 text-red-800 border-l-2 border-red-500 pl-2"
                            : "text-muted-foreground"
                        }`}
                      >
                        {part.value}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-muted/50 p-3 rounded-lg max-h-80 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {refreshResult.draft.content}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!isLoading && refreshResult && !refreshResult.hasChanges && (
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}

          {!isLoading && refreshResult && refreshResult.hasChanges && refreshResult.draft && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-2" />
                Discard Changes
              </Button>
              <Button onClick={handleApply} disabled={isApplying}>
                {isApplying ? (
                  <InlineLoader size="sm" className="mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Apply Updates
              </Button>
            </>
          )}

          {isLoading && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
