"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";

// Dynamic import to avoid SSR issues with the diff viewer
const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <div className="animate-pulse text-muted-foreground">Loading diff viewer...</div>
    </div>
  ),
});

interface SkillDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  skillTitle: string;
  originalContent: string;
  updatedContent: string;
  changeSummary?: string;
  changeHighlights?: string[];
  isLoading?: boolean;
}

export default function SkillDiffModal({
  isOpen,
  onClose,
  onAccept,
  onReject,
  skillTitle,
  originalContent,
  updatedContent,
  changeSummary,
  changeHighlights,
  isLoading = false,
}: SkillDiffModalProps) {
  const [splitView, setSplitView] = useState(true);
  const [showSummary, setShowSummary] = useState(true);

  const hasChanges = originalContent !== updatedContent;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Review Changes: {skillTitle}
          </DialogTitle>
          <DialogDescription>
            Review the suggested updates to this skill. Accept to apply changes or reject to keep the original.
          </DialogDescription>
        </DialogHeader>

        {/* Change Summary */}
        {(changeSummary || changeHighlights?.length) && (
          <div className="border rounded-lg bg-amber-50 border-amber-200">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <span className="font-medium text-amber-900">
                Change Summary
              </span>
              {showSummary ? (
                <ChevronUp className="h-4 w-4 text-amber-700" />
              ) : (
                <ChevronDown className="h-4 w-4 text-amber-700" />
              )}
            </button>
            {showSummary && (
              <div className="px-4 pb-3 space-y-2">
                {changeSummary && (
                  <p className="text-sm text-amber-800">{changeSummary}</p>
                )}
                {changeHighlights && changeHighlights.length > 0 && (
                  <ul className="text-sm text-amber-800 list-disc list-inside space-y-1">
                    {changeHighlights.map((highlight, i) => (
                      <li key={i}>{highlight}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View:</span>
            <Button
              variant={splitView ? "default" : "outline"}
              size="sm"
              onClick={() => setSplitView(true)}
            >
              Side by Side
            </Button>
            <Button
              variant={!splitView ? "default" : "outline"}
              size="sm"
              onClick={() => setSplitView(false)}
            >
              Unified
            </Button>
          </div>
          {!hasChanges && (
            <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">
              No changes detected
            </span>
          )}
        </div>

        {/* Diff Viewer */}
        <div className="flex-1 overflow-auto border rounded-lg bg-white min-h-[300px]">
          <ReactDiffViewer
            oldValue={originalContent}
            newValue={updatedContent}
            splitView={splitView}
            useDarkTheme={false}
            hideLineNumbers={false}
            showDiffOnly={false}
            extraLinesSurroundingDiff={3}
            leftTitle="Original"
            rightTitle="Updated"
            styles={{
              variables: {
                light: {
                  diffViewerBackground: "#ffffff",
                  addedBackground: "#e6ffec",
                  addedColor: "#24292f",
                  removedBackground: "#ffebe9",
                  removedColor: "#24292f",
                  wordAddedBackground: "#abf2bc",
                  wordRemovedBackground: "#ff8182",
                  addedGutterBackground: "#ccffd8",
                  removedGutterBackground: "#ffd7d5",
                  gutterBackground: "#f6f8fa",
                  gutterBackgroundDark: "#f0f0f0",
                  highlightBackground: "#fffbdd",
                  highlightGutterBackground: "#fff5b1",
                  codeFoldGutterBackground: "#dbedff",
                  codeFoldBackground: "#f1f8ff",
                  emptyLineBackground: "#fafbfc",
                },
              },
              contentText: {
                fontFamily: "ui-monospace, monospace",
                fontSize: "13px",
                lineHeight: "1.5",
              },
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onReject}
            disabled={isLoading}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Keep Original
          </Button>
          <Button
            onClick={onAccept}
            disabled={isLoading || !hasChanges}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            {isLoading ? "Applying..." : "Accept Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
