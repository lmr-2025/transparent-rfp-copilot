"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Filter, CheckSquare, Trash2, FileText, Globe, BarChart3 } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import LibraryAnalysisModal from "./components/LibraryAnalysisModal";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ConfirmModal";
import {
  useAllSkills,
  useAllDocuments,
  useAllReferenceUrls,
  useAllCategories,
  useDeleteSkill,
  useDeleteDocument,
  useDeleteUrl,
  useUpdateSkill,
  useRefreshSkill,
  useApplyRefreshChanges,
  skillToUnifiedItem,
  documentToUnifiedItem,
  urlToUnifiedItem,
  UnifiedLibraryItem,
  SkillOwner,
} from "@/hooks/use-knowledge-data";
import { useSyncHealthStatus } from "@/hooks/useSkillSyncStatus";
import { SyncHealthBar } from "@/components/knowledge/sync-health-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryTabs, TabType } from "./components/library-tabs";
import { KnowledgeItemCard } from "./components/knowledge-item-card";
import { cn } from "@/lib/utils";

// Source type filter for Sources tab
type SourceTypeFilter = "all" | "document" | "url";

function KnowledgeLibraryContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabType | null;

  // State
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || "skills");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // React Query data
  const { data: skills = [], isLoading: skillsLoading } = useAllSkills();
  const { data: documents = [], isLoading: documentsLoading } = useAllDocuments();
  const { data: urls = [], isLoading: urlsLoading } = useAllReferenceUrls();
  const { data: categories = [] } = useAllCategories();
  const { data: syncHealth, isLoading: syncHealthLoading, refetch: refetchSyncHealth } = useSyncHealthStatus();

  // Mutations
  const deleteSkillMutation = useDeleteSkill();
  const deleteDocumentMutation = useDeleteDocument();
  const deleteUrlMutation = useDeleteUrl();
  const updateSkillMutation = useUpdateSkill();
  const refreshSkillMutation = useRefreshSkill();
  const applyRefreshMutation = useApplyRefreshChanges();

  // Confirm dialog
  const { confirm: confirmDelete, ConfirmDialog } = useConfirm({
    title: "Delete Item",
    message: "Are you sure you want to delete this item? This action cannot be undone.",
    confirmLabel: "Delete",
    variant: "danger",
  });

  const isLoading = skillsLoading || documentsLoading || urlsLoading;

  // Create a map of skillId -> skill title for sources display
  const skillIdToTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const skill of skills) {
      map.set(skill.id, skill.title);
    }
    return map;
  }, [skills]);

  // Extract URLs from skills' sourceUrls field for the Sources tab
  const skillSourceUrls = useMemo((): UnifiedLibraryItem[] => {
    const items: UnifiedLibraryItem[] = [];
    const seenUrls = new Set<string>();

    for (const skill of skills) {
      if (skill.sourceUrls && Array.isArray(skill.sourceUrls)) {
        for (const source of skill.sourceUrls) {
          // Dedupe by URL
          if (seenUrls.has(source.url)) continue;
          seenUrls.add(source.url);

          // Use stored title or extract a readable one from the URL path
          let title = source.title;
          if (!title) {
            const urlObj = new URL(source.url);
            const pathParts = urlObj.pathname.split("/").filter(Boolean);
            const lastPart = pathParts[pathParts.length - 1] || urlObj.hostname;
            // Clean up: remove file extensions, replace dashes/underscores with spaces, title case
            title = lastPart
              .replace(/\.(md|html|htm|pdf|txt)$/i, "")
              .replace(/[-_]/g, " ")
              .replace(/\b\w/g, c => c.toUpperCase());
          }

          items.push({
            id: `skill-url-${skill.id}-${source.url}`,
            type: "url",
            title,
            subtitle: source.url,
            categories: skill.categories || [],
            createdAt: source.addedAt,
            updatedAt: source.lastFetchedAt || source.addedAt,
            linkedSkillId: skill.id,
          });
        }
      }
    }
    return items;
  }, [skills]);

  // Transform to unified items
  const allItems = useMemo((): UnifiedLibraryItem[] => {
    const items: UnifiedLibraryItem[] = [];

    if (activeTab === "skills") {
      items.push(...skills.map(skillToUnifiedItem));
    } else if (activeTab === "sources") {
      // Sources tab combines documents and URLs from skills
      if (sourceTypeFilter === "all" || sourceTypeFilter === "document") {
        items.push(...documents.map(documentToUnifiedItem));
      }
      if (sourceTypeFilter === "all" || sourceTypeFilter === "url") {
        // Use URLs extracted from skills' sourceUrls
        items.push(...skillSourceUrls);
        // Also include standalone ReferenceUrl records (not linked to skills)
        const skillUrlSet = new Set(skillSourceUrls.map(u => u.subtitle));
        const standaloneUrls = urls.filter(u => !skillUrlSet.has(u.url));
        items.push(...standaloneUrls.map(urlToUnifiedItem));
      }
    }

    return items;
  }, [activeTab, skills, documents, urls, sourceTypeFilter, skillSourceUrls]);

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

  // Handle update categories (skills only)
  const handleUpdateCategories = async (id: string, categories: string[]) => {
    try {
      await updateSkillMutation.mutateAsync({ id, updates: { categories } });
      toast.success("Categories updated");
    } catch (err) {
      toast.error("Failed to update categories");
      throw err;
    }
  };

  // Handle refresh skill from source URLs
  const handleRefreshSkill = async (id: string) => {
    try {
      const result = await refreshSkillMutation.mutateAsync(id);
      if (!result.hasChanges) {
        toast.success("Skill is already up to date");
      }
      return result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh skill");
      throw err;
    }
  };

  // Apply refresh changes after user review
  const handleApplyRefresh = async (
    id: string,
    title: string,
    content: string,
    changeHighlights?: string[]
  ) => {
    try {
      await applyRefreshMutation.mutateAsync({ id, title, content, changeHighlights });
      toast.success("Skill updated with new content");
    } catch (err) {
      toast.error("Failed to apply changes");
      throw err;
    }
  };

  // Update source URL title (for URLs derived from skills)
  const handleUpdateSourceUrlTitle = async (itemId: string, newTitle: string) => {
    // itemId format: skill-url-{skillId}-{url}
    const match = itemId.match(/^skill-url-([^-]+(?:-[^-]+)*?)-(.+)$/);
    if (!match) return;

    // Parse the ID to extract skillId and url
    const parts = itemId.replace("skill-url-", "").split("-");
    // URL is everything after the skill ID (which is a UUID with dashes)
    // Skill ID is 36 chars (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const skillId = itemId.substring("skill-url-".length, "skill-url-".length + 36);
    const url = itemId.substring("skill-url-".length + 36 + 1); // +1 for the dash

    const skill = skills.find(s => s.id === skillId);
    if (!skill) return;

    // Update the sourceUrls array with the new title
    const updatedSourceUrls = skill.sourceUrls.map(su =>
      su.url === url ? { ...su, title: newTitle } : su
    );

    try {
      await updateSkillMutation.mutateAsync({
        id: skillId,
        updates: { sourceUrls: updatedSourceUrls },
      });
      toast.success("URL title updated");
    } catch {
      toast.error("Failed to update title");
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
      }
      toast.success(`${item.type} deleted`);
    } catch {
      toast.error(`Failed to delete ${item.type}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Count sources: documents + skill source URLs + standalone reference URLs
  const standaloneUrlCount = urls.filter(u => !skillSourceUrls.some(su => su.subtitle === u.url)).length;
  const counts = {
    skills: skills.length,
    sources: documents.length + skillSourceUrls.length + standaloneUrlCount,
  };

  // Single unified "Add Knowledge" flow for both tabs
  const addLink = { href: "/knowledge/add", label: "Add Knowledge" };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Library</h1>
          <p className="text-muted-foreground mt-2">
            Manage the skills and source materials that power AI responses.
          </p>
        </div>
        <div className="flex gap-2">
          {!selectionMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowAnalysisModal(true)}
                disabled={skills.length < 2}
                title={skills.length < 2 ? "Need at least 2 skills to analyze" : "Analyze your library"}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analyze
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectionMode(true)}
                disabled={sortedItems.length === 0}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Select
              </Button>
              <Button asChild>
                <Link href={addLink.href} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {addLink.label}
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
                  <InlineLoader size="sm" className="mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Sync Health Bar - Only show on Skills tab and when we have sync data */}
      {activeTab === "skills" && syncHealth?.status && (
        <div className="mb-6">
          <SyncHealthBar
            status={syncHealth.status}
            isLoading={syncHealthLoading}
            onRefresh={() => refetchSyncHealth()}
          />
        </div>
      )}

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
        {/* Source type filter - only show on Sources tab */}
        {activeTab === "sources" && (
          <div className="flex border rounded-md overflow-hidden">
            {[
              { value: "all", label: "All", icon: null },
              { value: "document", label: "Docs", icon: <FileText className="h-3.5 w-3.5" /> },
              { value: "url", label: "URLs", icon: <Globe className="h-3.5 w-3.5" /> },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setSourceTypeFilter(item.value as SourceTypeFilter)}
                className={cn(
                  "px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors",
                  sourceTypeFilter === item.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted text-muted-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
        {/* Category filter - only show on Skills tab */}
        {activeTab === "skills" && (
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
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <InlineLoader size="lg" className="text-muted-foreground" />
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
                  <Link href={addLink.href}>
                    <Plus className="h-4 w-4 mr-2" />
                    {addLink.label}
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
              onUpdateCategories={item.type === "skill" && !selectionMode ? handleUpdateCategories : undefined}
              onRefresh={item.type === "skill" && !selectionMode ? handleRefreshSkill : undefined}
              onApplyRefresh={item.type === "skill" && !selectionMode ? handleApplyRefresh : undefined}
              onUpdateTitle={item.type === "url" && item.linkedSkillId && !selectionMode ? handleUpdateSourceUrlTitle : undefined}
              isRefreshing={refreshSkillMutation.isPending}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelection={() => toggleSelection(item.id)}
              linkedSkillName={item.linkedSkillId ? skillIdToTitle.get(item.linkedSkillId) : undefined}
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

      {/* Library Analysis Modal */}
      <LibraryAnalysisModal
        skills={skills}
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
      />
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
              <InlineLoader size="lg" className="text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <KnowledgeLibraryContent />
    </Suspense>
  );
}
