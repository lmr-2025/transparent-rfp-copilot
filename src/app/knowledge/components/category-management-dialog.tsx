"use client";

import { useState, useMemo } from "react";
import { X, Plus, Check, Tag } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCategories } from "@/hooks/use-knowledge";
import { cn } from "@/lib/utils";

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCategories: string[];
  onSave: (categories: string[]) => Promise<void>;
  itemTitle: string;
}

export function CategoryManagementDialog({
  open,
  onOpenChange,
  currentCategories,
  onSave,
  itemTitle,
}: CategoryManagementDialogProps) {
  const { data: allCategories = [], isLoading: categoriesLoading } = useCategories();
  const [selectedCategories, setSelectedCategories] = useState<string[]>(currentCategories);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return allCategories;
    const query = searchQuery.toLowerCase();
    return allCategories.filter((cat) =>
      cat.name.toLowerCase().includes(query)
    );
  }, [allCategories, searchQuery]);

  // Check if category is already selected
  const isSelected = (categoryName: string) =>
    selectedCategories.some((c) => c.toLowerCase() === categoryName.toLowerCase());

  // Add a category
  const addCategory = (categoryName: string) => {
    if (isSelected(categoryName)) return;
    setSelectedCategories([...selectedCategories, categoryName]);
  };

  // Remove a category
  const removeCategory = (categoryName: string) => {
    setSelectedCategories(
      selectedCategories.filter((c) => c.toLowerCase() !== categoryName.toLowerCase())
    );
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(selectedCategories);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset on open
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedCategories(currentCategories);
      setSearchQuery("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Manage Categories
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Assign categories to &ldquo;{itemTitle}&rdquo;
          </p>
        </DialogHeader>

        {/* Current Categories */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Current Categories</label>
          {selectedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No categories assigned</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map((category) => (
                <div
                  key={category}
                  className="flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm"
                >
                  <span>{category}</span>
                  <button
                    onClick={() => removeCategory(category)}
                    className="hover:bg-purple-200 rounded-full p-0.5"
                    aria-label={`Remove ${category}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Category */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Add Category</label>
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto border rounded-md">
            {categoriesLoading ? (
              <div className="py-4 flex items-center justify-center">
                <InlineLoader size="md" className="text-muted-foreground" />
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {searchQuery ? "No categories found" : "No categories available"}
              </div>
            ) : (
              <ul className="divide-y">
                {filteredCategories.map((category) => {
                  const alreadySelected = isSelected(category.name);
                  return (
                    <li
                      key={category.id}
                      className={cn(
                        "px-3 py-2 flex items-center justify-between",
                        alreadySelected
                          ? "bg-muted/50"
                          : "hover:bg-muted/30 cursor-pointer"
                      )}
                      onClick={() => !alreadySelected && addCategory(category.name)}
                    >
                      <div>
                        <div className="font-medium text-sm">{category.name}</div>
                        {category.description && (
                          <div className="text-xs text-muted-foreground">
                            {category.description}
                          </div>
                        )}
                      </div>
                      {alreadySelected ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <InlineLoader size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
