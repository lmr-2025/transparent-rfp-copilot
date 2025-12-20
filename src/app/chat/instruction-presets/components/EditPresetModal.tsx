"use client";

import { useRef } from "react";
import SnippetPicker from "@/components/SnippetPicker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InstructionPreset, insertAtCursor } from "./types";

type EditPresetModalProps = {
  isOpen: boolean;
  preset: InstructionPreset;
  editName: string;
  editDescription: string;
  editContent: string;
  onSetEditName: (value: string) => void;
  onSetEditDescription: (value: string) => void;
  onSetEditContent: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  actionInProgress: string | null;
};

export default function EditPresetModal({
  isOpen,
  preset,
  editName,
  editDescription,
  editContent,
  onSetEditName,
  onSetEditDescription,
  onSetEditContent,
  onSave,
  onClose,
  actionInProgress,
}: EditPresetModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSaving = actionInProgress === preset?.id;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Edit Preset</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => onSetEditName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => onSetEditDescription(e.target.value)}
              placeholder="Brief description (optional)"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium">
                Instructions
              </label>
              <SnippetPicker
                onInsert={(snippet) => insertAtCursor(textareaRef, snippet, onSetEditContent, editContent)}
              />
            </div>
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => onSetEditContent(e.target.value)}
              className="w-full min-h-[200px] p-3 border border-slate-200 rounded-md text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-400">
              Use {"{{snippet_key}}"} to insert context snippets. They&apos;ll be expanded when the preset is applied.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-indigo-500 hover:bg-indigo-600"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
