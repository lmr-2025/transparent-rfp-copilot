"use client";

import { useState } from "react";
import { X, Lightbulb, Plus, Link } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAllCategories } from "@/hooks/use-knowledge-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RequestKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestKnowledgeDialog({
  open,
  onOpenChange,
}: RequestKnowledgeDialogProps) {
  const { data: allCategories = [] } = useAllCategories();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle category selection
  const toggleCategory = (categoryName: string) => {
    if (selectedCategories.includes(categoryName)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== categoryName));
    } else {
      setSelectedCategories([...selectedCategories, categoryName]);
    }
  };

  // Add a URL
  const addUrl = () => {
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) return;

    try {
      new URL(trimmedUrl);
      if (!urls.includes(trimmedUrl)) {
        setUrls([...urls, trimmedUrl]);
      }
      setNewUrl("");
    } catch {
      toast.error("Please enter a valid URL");
    }
  };

  // Remove a URL
  const removeUrl = (url: string) => {
    setUrls(urls.filter((u) => u !== url));
  };

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSelectedCategories([]);
    setUrls([]);
    setNewUrl("");
  };

  // Handle dialog open/close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Submit the request
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title for your knowledge request");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Please provide a more detailed description (at least 10 characters)");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/knowledge-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          categories: selectedCategories,
          suggestedUrls: urls,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success("Knowledge request submitted successfully! An administrator will review it.");
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Request Knowledge
          </DialogTitle>
          <DialogDescription>
            Submit a request for new knowledge to be added to the library.
            An administrator will review your request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., SOC2 Compliance Requirements"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Describe what knowledge you need and why it would be useful..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what information would be helpful and how you plan to use it.
            </p>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Suggested Categories</label>
            <div className="flex flex-wrap gap-2">
              {allCategories.slice(0, 10).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.name)}
                  className={cn(
                    "px-3 py-1 rounded-full text-sm transition-colors",
                    selectedCategories.includes(category.name)
                      ? "bg-purple-100 text-purple-800 border border-purple-300"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent"
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Helpful URLs (optional)</label>
            <p className="text-xs text-muted-foreground">
              Add URLs that could help build this knowledge
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/resource"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addUrl();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addUrl}
                disabled={!newUrl.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {urls.length > 0 && (
              <div className="space-y-1 mt-2">
                {urls.map((url) => (
                  <div
                    key={url}
                    className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1 text-sm"
                  >
                    <Link className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{url}</span>
                    <button
                      onClick={() => removeUrl(url)}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || description.trim().length < 10}
          >
            {isSubmitting ? (
              <>
                <InlineLoader size="sm" className="mr-2" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
