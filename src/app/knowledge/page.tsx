"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Filter, CheckSquare, Trash2, FileText, Globe, BarChart3, ArrowUpDown, LayoutGrid, List, Lightbulb, Upload, Tag, Power, Download } from "lucide-react";
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
import { useSyncHealthStatus, useSyncSkillToGit } from "@/hooks/useSkillSyncStatus";
import { SyncHealthBar } from "@/components/knowledge/sync-health-bar";
import { useSession } from "next-auth/react";
import { canManageKnowledge, type UserSession } from "@/lib/permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LibraryTabs, TabType } from "./components/library-tabs";
import { KnowledgeItemCard } from "./components/knowledge-item-card";
import { KnowledgeGridTile } from "./components/knowledge-grid-tile";
import { CollapsibleCategorySection } from "./components/collapsible-category-section";
import { RequestKnowledgeDialog } from "./components/request-knowledge-dialog";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// View mode
type ViewMode = "list" | "grid";

// Source type filter for Sources tab
type SourceTypeFilter = "all" | "document" | "url";

// Sort options
type SortOption = "updated-desc" | "updated-asc" | "name-asc" | "name-desc" | "category";

function KnowledgeLibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as TabType | null;
  const { data: session } = useSession();

  // Check if user can manage knowledge (edit skills)
  // Dev override: add ?testRequestUI=true to see the "Request Knowledge" button as a non-manager
  const testRequestUI = searchParams.get("testRequestUI") === "true";
  const userCanManageKnowledge = testRequestUI
    ? false
    : canManageKnowledge(session?.user as UserSession | undefined);

  // State
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || "skills");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("updated-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [expandedGridItemId, setExpandedGridItemId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [isBulkToggling, setIsBulkToggling] = useState(false);
  const [showBulkCategoryDialog, setShowBulkCategoryDialog] = useState(false);
  const [bulkSelectedCategories, setBulkSelectedCategories] = useState<Set<string>>(new Set());
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  // Handle tab change with URL sync
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/knowledge?tab=${tab}`, { scroll: false });
  };

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
  const syncSkillMutation = useSyncSkillToGit();

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

  // Sort items based on selected sort option
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      switch (sortOption) {
        case "name-asc":
          return a.title.localeCompare(b.title);
        case "name-desc":
          return b.title.localeCompare(a.title);
        case "updated-asc":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "category":
          // Sort by first category, then by name
          const catA = a.categories?.[0] || "zzz"; // Items without category go last
          const catB = b.categories?.[0] || "zzz";
          const catCompare = catA.localeCompare(catB);
          return catCompare !== 0 ? catCompare : a.title.localeCompare(b.title);
        case "updated-desc":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  }, [filteredItems, sortOption]);

  // Group items by category (only used when sortOption is "category")
  const groupedByCategory = useMemo(() => {
    if (sortOption !== "category") return null;

    const groups: Record<string, typeof sortedItems> = {};

    for (const item of sortedItems) {
      const category = item.categories?.[0] || "Uncategorized";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    }

    // Sort category names alphabetically, but put "Uncategorized" last
    const sortedCategories = Object.keys(groups).sort((a, b) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });

    return { groups, sortedCategories };
  }, [sortedItems, sortOption]);

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

  // Bulk sync handler (skills only)
  const handleBulkSync = async () => {
    const skillIds = Array.from(selectedIds).filter((id) => {
      const item = sortedItems.find((i) => i.id === id);
      return item?.type === "skill";
    });

    if (skillIds.length === 0) {
      toast.error("No skills selected to sync");
      return;
    }

    setIsBulkSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of skillIds) {
      try {
        await syncSkillMutation.mutateAsync(id);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsBulkSyncing(false);
    clearSelection();

    if (errorCount === 0) {
      toast.success(`Synced ${successCount} skills to Git`);
    } else {
      toast.error(`Synced ${successCount} skills, ${errorCount} failed`);
    }
  };

  // Bulk toggle active handler (skills only)
  const handleBulkToggleActive = async (setActive: boolean) => {
    const skillIds = Array.from(selectedIds).filter((id) => {
      const item = sortedItems.find((i) => i.id === id);
      return item?.type === "skill";
    });

    if (skillIds.length === 0) {
      toast.error("No skills selected");
      return;
    }

    setIsBulkToggling(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of skillIds) {
      try {
        await updateSkillMutation.mutateAsync({ id, updates: { isActive: setActive } });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsBulkToggling(false);
    clearSelection();

    const action = setActive ? "activated" : "deactivated";
    if (errorCount === 0) {
      toast.success(`${successCount} skills ${action}`);
    } else {
      toast.error(`${successCount} skills ${action}, ${errorCount} failed`);
    }
  };

  // Bulk update categories handler
  const handleBulkUpdateCategories = async (newCategories: string[]) => {
    const skillIds = Array.from(selectedIds).filter((id) => {
      const item = sortedItems.find((i) => i.id === id);
      return item?.type === "skill";
    });

    if (skillIds.length === 0) {
      toast.error("No skills selected");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const id of skillIds) {
      try {
        await updateSkillMutation.mutateAsync({ id, updates: { categories: newCategories } });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    clearSelection();
    setShowBulkCategoryDialog(false);

    if (errorCount === 0) {
      toast.success(`Updated categories for ${successCount} skills`);
    } else {
      toast.error(`Updated ${successCount} skills, ${errorCount} failed`);
    }
  };

  // Export selected skills
  const handleExportSelected = () => {
    const selectedSkills = skills.filter((s) => selectedIds.has(s.id));

    if (selectedSkills.length === 0) {
      toast.error("No skills selected to export");
      return;
    }

    const exportData = selectedSkills.map((skill) => ({
      title: skill.title,
      categories: skill.categories,
      content: skill.content,
      sourceUrls: skill.sourceUrls,
      isActive: skill.isActive,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skills-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${selectedSkills.length} skills`);
    clearSelection();
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

  // Handle update content (inline editing for skills)
  const handleUpdateContent = async (id: string, title: string, content: string) => {
    try {
      await updateSkillMutation.mutateAsync({ id, updates: { title, content } });
      toast.success("Skill content updated");
    } catch (err) {
      toast.error("Failed to update content");
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
    <div className={cn("mx-auto p-6", viewMode === "grid" ? "max-w-7xl" : "max-w-5xl")}>
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
              {userCanManageKnowledge ? (
                <Button asChild>
                  <Link href={addLink.href} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {addLink.label}
                  </Link>
                </Button>
              ) : (
                <Button onClick={() => setShowRequestDialog(true)}>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Request Knowledge
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={clearSelection}>
                Cancel
              </Button>
              <Button variant="outline" onClick={selectAll}>
                Select All ({sortedItems.length})
              </Button>
              {/* Bulk actions - only show on Skills tab */}
              {activeTab === "skills" && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleBulkSync}
                    disabled={selectedIds.size === 0 || isBulkSyncing}
                  >
                    {isBulkSyncing ? (
                      <InlineLoader size="sm" className="mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Sync
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowBulkCategoryDialog(true)}
                    disabled={selectedIds.size === 0}
                  >
                    <Tag className="h-4 w-4 mr-2" />
                    Category
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleBulkToggleActive(true)}
                    disabled={selectedIds.size === 0 || isBulkToggling}
                  >
                    {isBulkToggling ? (
                      <InlineLoader size="sm" className="mr-2" />
                    ) : (
                      <Power className="h-4 w-4 mr-2" />
                    )}
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportSelected}
                    disabled={selectedIds.size === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </>
              )}
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
        <LibraryTabs activeTab={activeTab} onTabChange={handleTabChange} counts={counts} />
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
        {/* Category filter */}
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
        {/* Sort dropdown */}
        <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated-desc">Newest First</SelectItem>
            <SelectItem value="updated-asc">Oldest First</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="category">By Category</SelectItem>
          </SelectContent>
        </Select>
        {/* View toggle - only show for skills tab (sources are always list view) */}
        {activeTab === "skills" && (
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              )}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
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
                  No {activeTab} yet. {userCanManageKnowledge ? "Add your first one to get started." : "Request knowledge to be added."}
                </p>
                {userCanManageKnowledge ? (
                  <Button asChild>
                    <Link href={addLink.href}>
                      <Plus className="h-4 w-4 mr-2" />
                      {addLink.label}
                    </Link>
                  </Button>
                ) : (
                  <Button onClick={() => setShowRequestDialog(true)}>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Request Knowledge
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" && activeTab === "skills" ? (
        // Grid view (skills only - sources always use list view)
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedItems.map((item) => (
              <KnowledgeGridTile
                key={item.id}
                item={item}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(item.id)}
                onToggleSelection={() => toggleSelection(item.id)}
                onClick={() => setExpandedGridItemId(item.id)}
              />
            ))}
          </div>

          {/* Expanded item card overlay for grid view */}
          {expandedGridItemId && (() => {
            const expandedItem = sortedItems.find(i => i.id === expandedGridItemId);
            if (!expandedItem) return null;
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setExpandedGridItemId(null);
                }}
              >
                <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
                  <KnowledgeItemCard
                    item={expandedItem}
                    onDelete={() => {
                      handleDelete(expandedItem);
                      setExpandedGridItemId(null);
                    }}
                    isDeleting={deletingId === expandedItem.id}
                    onUpdateOwners={expandedItem.type === "skill" ? handleUpdateOwners : undefined}
                    onUpdateContent={expandedItem.type === "skill" && userCanManageKnowledge ? handleUpdateContent : undefined}
                    onUpdateCategories={expandedItem.type === "skill" ? handleUpdateCategories : undefined}
                    onRefresh={expandedItem.type === "skill" ? handleRefreshSkill : undefined}
                    onApplyRefresh={expandedItem.type === "skill" ? handleApplyRefresh : undefined}
                    onUpdateTitle={expandedItem.type === "url" && expandedItem.linkedSkillId ? handleUpdateSourceUrlTitle : undefined}
                    isRefreshing={refreshSkillMutation.isPending}
                    linkedSkillName={expandedItem.linkedSkillId ? skillIdToTitle.get(expandedItem.linkedSkillId) : undefined}
                    onClose={() => setExpandedGridItemId(null)}
                  />
                </div>
              </div>
            );
          })()}
        </>
      ) : sortOption === "category" && groupedByCategory ? (
        // List view - grouped by category with collapsible sections
        <div>
          {groupedByCategory.sortedCategories.map((categoryName) => (
            <CollapsibleCategorySection
              key={categoryName}
              categoryName={categoryName}
              itemCount={groupedByCategory.groups[categoryName].length}
            >
              {groupedByCategory.groups[categoryName].map((item) => (
                <KnowledgeItemCard
                  key={item.id}
                  item={item}
                  onDelete={selectionMode ? undefined : () => handleDelete(item)}
                  isDeleting={deletingId === item.id}
                  onUpdateOwners={item.type === "skill" && !selectionMode ? handleUpdateOwners : undefined}
                  onUpdateContent={item.type === "skill" && !selectionMode && userCanManageKnowledge ? handleUpdateContent : undefined}
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
            </CollapsibleCategorySection>
          ))}
        </div>
      ) : (
        // List view - flat list
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <KnowledgeItemCard
              key={item.id}
              item={item}
              onDelete={selectionMode ? undefined : () => handleDelete(item)}
              isDeleting={deletingId === item.id}
              onUpdateOwners={item.type === "skill" && !selectionMode ? handleUpdateOwners : undefined}
              onUpdateContent={item.type === "skill" && !selectionMode && userCanManageKnowledge ? handleUpdateContent : undefined}
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

      {/* Request Knowledge Dialog - for users without MANAGE_KNOWLEDGE capability */}
      <RequestKnowledgeDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
      />

      {/* Bulk Category Dialog */}
      <Dialog
        open={showBulkCategoryDialog}
        onOpenChange={(open) => {
          setShowBulkCategoryDialog(open);
          if (!open) setBulkSelectedCategories(new Set());
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Categories</DialogTitle>
            <DialogDescription>
              Select categories to assign to {selectedIds.size} selected skill{selectedIds.size !== 1 ? "s" : ""}.
              This will replace existing categories.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 py-4">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={bulkSelectedCategories.has(cat.name) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const newSet = new Set(bulkSelectedCategories);
                  if (newSet.has(cat.name)) {
                    newSet.delete(cat.name);
                  } else {
                    newSet.add(cat.name);
                  }
                  setBulkSelectedCategories(newSet);
                }}
              >
                {cat.name}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkCategoryDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleBulkUpdateCategories(Array.from(bulkSelectedCategories))}
              disabled={bulkSelectedCategories.size === 0}
            >
              Apply to {selectedIds.size} Skills
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
