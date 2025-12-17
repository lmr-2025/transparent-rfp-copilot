"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, BookOpen, Archive } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DocumentMeta {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  contentLength?: number;
}

interface DocumentActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentMeta | null;
  onSaveAsReference: (id: string) => Promise<void>;
}

export function DocumentActionDialog({
  open,
  onOpenChange,
  document,
  onSaveAsReference,
}: DocumentActionDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  if (!document) return null;

  const handleCreateSkill = () => {
    // Navigate to knowledge add page with document ID
    router.push(`/knowledge/add?docId=${document.id}`);
    onOpenChange(false);
  };

  const handleSaveAsReference = async () => {
    setIsLoading(true);
    try {
      await onSaveAsReference(document.id);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Uploaded Successfully
          </DialogTitle>
          <DialogDescription>
            &ldquo;{document.title}&rdquo; has been uploaded. What would you like to do with it?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Create Skill - Primary action */}
          <button
            onClick={handleCreateSkill}
            disabled={isLoading}
            className="w-full p-4 text-left border-2 border-blue-200 bg-blue-50 rounded-lg hover:border-blue-400 hover:bg-blue-100 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200">
                <BookOpen className="h-5 w-5 text-blue-700" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-blue-900">Create Skill from Document</div>
                <p className="text-sm text-blue-700 mt-1">
                  Convert this document into structured knowledge that the AI can use to answer questions.
                  <span className="font-medium"> Recommended for most documents.</span>
                </p>
              </div>
            </div>
          </button>

          {/* Save as Reference - Secondary action */}
          <button
            onClick={handleSaveAsReference}
            disabled={isLoading}
            className="w-full p-4 text-left border border-gray-200 bg-white rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200">
                {isLoading ? (
                  <InlineLoader size="md" className="text-gray-600" />
                ) : (
                  <Archive className="h-5 w-5 text-gray-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">Save as Reference Only</div>
                <p className="text-sm text-gray-600 mt-1">
                  Keep this document for future use (templates, GTM materials) without creating a skill now.
                  You can convert it to a skill later.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
