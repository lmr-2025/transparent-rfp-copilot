"use client";

import { useRef } from "react";
import SnippetPicker from "@/components/SnippetPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { insertAtCursor } from "./types";

type CreatePresetModalProps = {
  isOpen: boolean;
  newName: string;
  newDescription: string;
  newContent: string;
  onSetNewName: (value: string) => void;
  onSetNewDescription: (value: string) => void;
  onSetNewContent: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
  actionInProgress: string | null;
};

export default function CreatePresetModal({
  isOpen,
  newName,
  newDescription,
  newContent,
  onSetNewName,
  onSetNewDescription,
  onSetNewContent,
  onCreate,
  onClose,
  actionInProgress,
}: CreatePresetModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = () => {
    onSetNewName("");
    onSetNewDescription("");
    onSetNewContent("");
    onClose();
  };

  const isDisabled = actionInProgress === "create" || !newName.trim() || !newContent.trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Create Org Preset</DialogTitle>
          <DialogDescription>
            This preset will be immediately available to all users.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => onSetNewName(e.target.value)}
              placeholder="e.g., Security Questionnaire Expert"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => onSetNewDescription(e.target.value)}
              placeholder="Brief description of when to use this preset"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium">
                Instructions *
              </label>
              <SnippetPicker
                onInsert={(snippet) => insertAtCursor(textareaRef, snippet, onSetNewContent, newContent)}
              />
            </div>
            <textarea
              ref={textareaRef}
              value={newContent}
              onChange={(e) => onSetNewContent(e.target.value)}
              placeholder="Enter the instruction text that will guide the AI's behavior..."
              className="w-full min-h-[200px] p-3 border border-slate-200 rounded-md text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-400">
              Use {"{{snippet_key}}"} to insert context snippets. They&apos;ll be expanded when the preset is applied.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={onCreate}
            disabled={isDisabled}
            className="bg-indigo-500 hover:bg-indigo-600"
          >
            {actionInProgress === "create" ? "Creating..." : "Create Preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
