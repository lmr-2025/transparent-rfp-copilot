"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Loader2, Filter, CheckSquare, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ConfirmModal";
import {
  useAllSkills,
  useAllDocuments,
  useAllReferenceUrls,
  useAllSnippets,
  useAllCategories,
  useDeleteSkill,
  useDeleteDocument,
  useDeleteUrl,
  useDeleteSnippet,
  useUpdateSkill,
  skillToUnifiedItem,
  documentToUnifiedItem,
  urlToUnifiedItem,
  snippetToUnifiedItem,
  UnifiedLibraryItem,
  SkillOwner,
} from "@/hooks/use-knowledge-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryTabs, TabType } from "./components/library-tabs";
import { KnowledgeItemCard } from "./components/knowledge-item-card";

function KnowledgeLibraryContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabType | null;

  // State
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || "skills");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // React Query data
  const { data: skills = [], isLoading: skillsLoading } = useAllSkills();
  const { data: documents = [], isLoading: documentsLoading } = useAllDocuments();
  const { data: urls = [], isLoading: urlsLoading } = useAllReferenceUrls();
  const { data: snippets = [], isLoading: snippetsLoading } = useAllSnippets();
  const { data: categories = [] } = useAllCategories();

  // Mutations
  const deleteSkillMutation = useDeleteSkill();
  const deleteDocumentMutation = useDeleteDocument();
  const deleteUrlMutation = useDeleteUrl();
  const deleteSnippetMutation = useDeleteSnippet();
  const updateSkillMutation = useUpdateSkill();

  // Confirm dialog
  const { confirm: confirmDelete, ConfirmDialog } = useConfirm({
    title: "Delete Item",
    message: "Are you sure you want to delete this item? This action cannot be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  });

  const isLoading = skillsLoading || documentsLoading || urlsLoading || snippetsLoading;

  // Transform to unified items
  const allItems = useMemo((): UnifiedLibraryItem[] => {
    const items: UnifiedLibraryItem[] = [];

    if (activeTab === "skills") {
      items.push(...skills.map(skillToUnifiedItem));
    } else if (activeTab === "documents") {
      items.push(...documents.map(documentToUnifiedItem));
    } else if (activeTab === "urls") {
      items.push(...urls.map(urlToUnifiedItem));
    } else if (activeTab === "snippets") {
      items.push(...snippets.map(snippetToUnifiedItem));
    }

    return items;
  }, [activeTab, skills, documents, urls, snippets]);

  // Filter items by search and category
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Filter by category
    if (selectedCategory && selectedCategory !== "all") {
      items = items.filter((item) =>
        item.categories?.some(
          (cat) => cat.toLowerCase() === selectedCategory.toLowerCase()
        )
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.subtitle?.toLowerCase().includes(query) ||
          item.content?.toLowerCase().includes(query)
      );
    }

    return items;
  }, [allItems, searchQuery, selectedCategory]);

  // Sort by updated date (newest first)
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [filteredItems]);

  // Selection helpers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedItems.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = await confirmDelete({
      title: `Delete ${selectedIds.size} items`,
      message: `Are you sure you want to delete ${selectedIds.size} ${activeTab}? This action cannot be undone.`,
    });
    if (!confirmed) return;

    setIsBulkDeleting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      const item = sortedItems.find((i) => i.id === id);
      if (!item) continue;

      try {
        switch (item.type) {
          case "skill":
            await deleteSkillMutation.mutateAsync(id);
            break;
          case "document":
            await deleteDocumentMutation.mutateAsync(id);
            break;
          case "url":
            await deleteUrlMutation.mutateAsync(id);
            break;
          case "snippet":
            await deleteSnippetMutation.mutateAsync(id);
            break;
        }
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsBulkDeleting(false);
    clearSelection();

    if (errorCount === 0) {
      toast.success(`Deleted ${successCount} items`);
    } else {
      toast.error(`Deleted ${successCount} items, ${errorCount} failed`);
    }
  };

  // Handle update owners (skills only)
  const handleUpdateOwners = async (id: string, owners: SkillOwner[]) => {
    try {
      await updateSkillMutation.mutateAsync({ id, updates: { owners } });
      toast.success("Owners updated");
    } catch (err) {
      toast.error("Failed to update owners");
      throw err; // Re-throw so dialog knows it failed
    }
  };

  // Handle delete
  const handleDelete = async (item: UnifiedLibraryItem) => {
    const confirmed = await confirmDelete({
      title: `Delete ${item.type}`,
      message: `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
    });
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      switch (item.type) {
        case "skill":
          await deleteSkillMutation.mutateAsync(item.id);
          break;
        case "document":
          await deleteDocumentMutation.mutateAsync(item.id);
          break;
        case "url":
          await deleteUrlMutation.mutateAsync(item.id);
          break;
        case "snippet":
          await deleteSnippetMutation.mutateAsync(item.id);
          break;
      }
      toast.success(`${item.type} deleted`);
    } catch (err) {
      toast.error(`Failed to delete ${item.type}`);
    } finally {
      setDeletingId(null);
    }
  };

  const counts = {
    skills: skills.length,
    documents: documents.length,
    urls: urls.length,
    snippets: snippets.length,
  };

  const addLinks: Record<TabType, { href: string; label: string }> = {
    skills: { href: "/knowledge/add", label: "Add Skill" },
    documents: { href: "/knowledge/documents", label: "Upload Document" },
    urls: { href: "/knowledge/urls/add", label: "Add URL" },
    snippets: { href: "/knowledge/snippets", label: "Add Snippet" },
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Library</h1>
          <p className="text-muted-foreground mt-2">
            Manage your skills, documents, URLs, and snippets that power AI responses.
          </p>
        </div>
        <div className="flex gap-2">
          {!selectionMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setSelectionMode(true)}
                disabled={sortedItems.length === 0}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Select
              </Button>
              <Button asChild>
                <Link href={addLinks[activeTab].href} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {addLinks[activeTab].label}
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={clearSelection}>
                Cancel
              </Button>
              <Button variant="outline" onClick={selectAll}>
                Select All ({sortedItems.length})
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || isBulkDeleting}
              >
                {isBulkDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <LibraryTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.name}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : sortedItems.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            {searchQuery || selectedCategory !== "all" ? (
              <>
                <p className="text-muted-foreground">
                  No {activeTab} found
                  {searchQuery && ` matching "${searchQuery}"`}
                  {selectedCategory !== "all" && ` in "${selectedCategory}"`}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  No {activeTab} yet. Add your first one to get started.
                </p>
                <Button asChild>
                  <Link href={addLinks[activeTab].href}>
                    <Plus className="h-4 w-4 mr-2" />
                    {addLinks[activeTab].label}
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <KnowledgeItemCard
              key={item.id}
              item={item}
              onDelete={selectionMode ? undefined : () => handleDelete(item)}
              isDeleting={deletingId === item.id}
              onUpdateOwners={item.type === "skill" && !selectionMode ? handleUpdateOwners : undefined}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelection={() => toggleSelection(item.id)}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {!isLoading && sortedItems.length > 0 && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Showing {sortedItems.length} of {allItems.length} {activeTab}
          {searchQuery && ` matching "${searchQuery}"`}
          {selectedCategory !== "all" && ` in "${selectedCategory}"`}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto p-6">
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <KnowledgeLibraryContent />
    </Suspense>
  );
}
