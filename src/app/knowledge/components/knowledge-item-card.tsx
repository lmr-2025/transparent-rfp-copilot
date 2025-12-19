"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ChevronDown, ChevronUp, BookOpen, FileText, Globe, Code, User, ExternalLink, History, UserCog, CheckSquare, Square, RefreshCw, Tag, FolderOpen, Wand2, Link2, Pencil, Check, X } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UnifiedLibraryItem, LibraryItemType, SkillOwner, RefreshResult, SyncStatus } from "@/hooks/use-knowledge-data";
import { OwnerManagementDialog } from "./owner-management-dialog";
import { SkillRefreshDialog } from "./skill-refresh-dialog";
import { CategoryManagementDialog } from "./category-management-dialog";
import { SkillSourcesDialog } from "./skill-sources-dialog";
import { SkillHistoryDialog } from "./skill-history-dialog";
import { SkillSyncLogsDialog } from "@/components/knowledge/skill-sync-logs-dialog";
import { SyncStatusBadge } from "@/components/ui/sync-status-badge";
import { GitBranch } from "lucide-react";

interface KnowledgeItemCardProps {
  item: UnifiedLibraryItem;
  onDelete?: () => void;
  isDeleting?: boolean;
  onUpdateOwners?: (id: string, owners: SkillOwner[]) => Promise<void>;
  onRefresh?: (id: string) => Promise<RefreshResult>;
  onApplyRefresh?: (id: string, title: string, content: string, changeHighlights?: string[]) => Promise<void>;
  onUpdateCategories?: (id: string, categories: string[]) => Promise<void>;
  onUpdateTitle?: (id: string, newTitle: string) => Promise<void>;
  isRefreshing?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  linkedSkillName?: string; // Name of linked skill (for sources)
}

export function KnowledgeItemCard({
  item,
  onDelete,
  isDeleting,
  onUpdateOwners,
  onRefresh,
  onApplyRefresh,
  onUpdateCategories,
  onUpdateTitle,
  isRefreshing,
  selectionMode,
  isSelected,
  onToggleSelection,
  linkedSkillName,
}: KnowledgeItemCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showSourcesDialog, setShowSourcesDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showSyncLogsDialog, setShowSyncLogsDialog] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(item.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const typeConfig = getTypeConfig(item.type);

  // URLs with onUpdateTitle can have editable titles
  const canEditTitle = item.type === "url" && onUpdateTitle && !selectionMode;

  // Only skills support owner management
  const canManageOwners = item.type === "skill" && onUpdateOwners;

  // Only skills support category management
  const canManageCategories = item.type === "skill" && onUpdateCategories;

  // Skills with source URLs can be refreshed
  const canRefresh = item.type === "skill" && item.sourceUrls && item.sourceUrls.length > 0 && onRefresh;

  // Skills can view sources and history
  const canViewSources = item.type === "skill";
  const canViewHistory = item.type === "skill" && item.history && item.history.length > 0;

  // Documents can be converted to skills
  const canConvertToSkill = item.type === "document";

  const handleSaveTitle = async () => {
    if (!onUpdateTitle || editedTitle === item.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      await onUpdateTitle(item.id, editedTitle);
      setIsEditingTitle(false);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedTitle(item.title);
    setIsEditingTitle(false);
  };

  const handleConvertToSkill = () => {
    if (item.type === "document") {
      router.push(`/knowledge/add?docId=${item.id}`);
    }
  };

  const handleRefreshClick = async () => {
    if (!onRefresh) return;
    setShowRefreshDialog(true);
    try {
      const result = await onRefresh(item.id);
      setRefreshResult(result);
    } catch (error) {
      // Error will be shown in dialog
      setRefreshResult(null);
    }
  };

  const handleApplyRefresh = async (title: string, content: string, changeHighlights?: string[]) => {
    if (!onApplyRefresh) return;
    await onApplyRefresh(item.id, title, content, changeHighlights);
    setShowRefreshDialog(false);
    setRefreshResult(null);
  };

  const handleCloseRefreshDialog = () => {
    setShowRefreshDialog(false);
    setRefreshResult(null);
  };

  const handleSaveOwners = async (owners: SkillOwner[]) => {
    if (onUpdateOwners) {
      await onUpdateOwners(item.id, owners);
    }
  };

  const handleSaveCategories = async (categories: string[]) => {
    if (onUpdateCategories) {
      await onUpdateCategories(item.id, categories);
    }
  };

  const handleCardClick = () => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection();
    }
  };

  return (
    <Card
      className={cn(
        "transition-all group",
        !item.isActive && item.type === "skill" && "opacity-60",
        selectionMode && "cursor-pointer hover:border-blue-400",
        isSelected && "border-blue-500 bg-blue-50/50"
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Selection checkbox */}
            {selectionMode && (
              <div className="flex-shrink-0 pt-1">
                {isSelected ? (
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            )}
            <div className={cn("p-2 rounded-lg flex-shrink-0", typeConfig.bgColor)}>
              <typeConfig.Icon className={cn("h-4 w-4", typeConfig.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isEditingTitle ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTitle();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveTitle}
                      disabled={isSavingTitle}
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                    >
                      {isSavingTitle ? <InlineLoader size="sm" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                    {canEditTitle && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingTitle(true)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
                {item.type === "skill" && !item.isActive && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    Inactive
                  </span>
                )}
                {item.type === "skill" && (
                  <SyncStatusBadge
                    status={item.syncStatus ?? null}
                    lastSyncedAt={item.lastSyncedAt}
                    showLabel={false}
                  />
                )}
              </div>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
              )}
              {/* Linked skill badge for sources */}
              {linkedSkillName && (
                <div className="flex items-center gap-1 mt-2">
                  <Link2 className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">
                    {linkedSkillName}
                  </span>
                </div>
              )}
              {/* Owners */}
              {item.owners && item.owners.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {item.owners.map((o) => o.name).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {canViewSources && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSourcesDialog(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600"
                aria-label="View sources"
                title="View sources"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            )}
            {canViewHistory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistoryDialog(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600"
                aria-label="View history"
                title="View history"
              >
                <History className="h-4 w-4" />
              </Button>
            )}
            {item.type === "skill" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSyncLogsDialog(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-cyan-600"
                aria-label="View sync logs"
                title="View sync logs"
              >
                <GitBranch className="h-4 w-4" />
              </Button>
            )}
            {canRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-green-600"
                aria-label="Refresh from source URLs"
                title="Refresh from source URLs"
              >
                {isRefreshing ? (
                  <InlineLoader size="sm" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
            {canManageCategories && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCategoryDialog(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-purple-600"
                aria-label="Manage categories"
                title="Manage categories"
              >
                <Tag className="h-4 w-4" />
              </Button>
            )}
            {canManageOwners && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOwnerDialog(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
                aria-label="Manage owners"
              >
                <UserCog className="h-4 w-4" />
              </Button>
            )}
            {canConvertToSkill && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleConvertToSkill}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-violet-600"
                aria-label="Convert to skill"
                title="Convert to skill"
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={isDeleting}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                aria-label={isDeleting ? "Deleting item" : "Delete item"}
              >
                {isDeleting ? (
                  <InlineLoader size="sm" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            {/* Content preview */}
            {item.content && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span>Content</span>
                  <span className="font-normal text-muted-foreground/70">{item.content.length.toLocaleString()} characters</span>
                </h4>
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans max-h-96 overflow-y-auto bg-muted/50 p-3 rounded-md">
                  {item.content}
                </pre>
              </div>
            )}

            {/* Source URLs (skills only) */}
            {item.type === "skill" && item.sourceUrls && item.sourceUrls.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Source URLs ({item.sourceUrls.length})
                </h4>
                <ul className="space-y-1">
                  {item.sourceUrls.map((src, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate flex items-center gap-1"
                      >
                        {src.url}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        added {new Date(src.addedAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* History (skills only) */}
            {item.type === "skill" && item.history && item.history.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <History className="h-3 w-3" />
                  History
                </h4>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {item.history.slice(0, 10).map((entry, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="font-medium">{new Date(entry.date).toLocaleDateString()}</span>
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">{entry.action}</span>
                      <span className="truncate">{entry.summary}</span>
                      {entry.user && <span className="text-muted-foreground/70">by {entry.user}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Document details */}
            {item.type === "document" && (item.filename || item.fileSize) && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {item.filename && <span>{item.filename}</span>}
                {item.fileSize && <span>{formatFileSize(item.fileSize)}</span>}
                {item.fileType && <span className="uppercase">{item.fileType}</span>}
              </div>
            )}

            {/* Snippet key */}
            {item.type === "snippet" && item.snippetKey && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Key: </span>
                <code className="bg-muted px-1.5 py-0.5 rounded">{`{{${item.snippetKey}}}`}</code>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{typeConfig.label}</span>
          <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
        </div>
      </CardContent>

      {/* Owner Management Dialog */}
      {canManageOwners && (
        <OwnerManagementDialog
          open={showOwnerDialog}
          onOpenChange={setShowOwnerDialog}
          currentOwners={item.owners || []}
          onSave={handleSaveOwners}
          itemTitle={item.title}
        />
      )}

      {/* Skill Refresh Dialog */}
      {canRefresh && (
        <SkillRefreshDialog
          open={showRefreshDialog}
          onOpenChange={handleCloseRefreshDialog}
          skillTitle={item.title}
          refreshResult={refreshResult}
          isLoading={!!isRefreshing && !refreshResult}
          onApply={handleApplyRefresh}
        />
      )}

      {/* Category Management Dialog */}
      {canManageCategories && (
        <CategoryManagementDialog
          open={showCategoryDialog}
          onOpenChange={setShowCategoryDialog}
          currentCategories={item.categories || []}
          onSave={handleSaveCategories}
          itemTitle={item.title}
        />
      )}

      {/* Sources Dialog */}
      {canViewSources && (
        <SkillSourcesDialog
          open={showSourcesDialog}
          onOpenChange={setShowSourcesDialog}
          item={item}
        />
      )}

      {/* History Dialog */}
      {canViewHistory && (
        <SkillHistoryDialog
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
          item={item}
        />
      )}

      {/* Sync Logs Dialog */}
      {item.type === "skill" && (
        <SkillSyncLogsDialog
          open={showSyncLogsDialog}
          onOpenChange={setShowSyncLogsDialog}
          skillId={item.id}
          skillTitle={item.title}
        />
      )}
    </Card>
  );
}

function getTypeConfig(type: LibraryItemType) {
  switch (type) {
    case "skill":
      return {
        Icon: BookOpen,
        label: "Skill",
        bgColor: "bg-blue-100",
        iconColor: "text-blue-600",
      };
    case "document":
      return {
        Icon: FileText,
        label: "Document",
        bgColor: "bg-green-100",
        iconColor: "text-green-600",
      };
    case "url":
      return {
        Icon: Globe,
        label: "Reference URL",
        bgColor: "bg-purple-100",
        iconColor: "text-purple-600",
      };
    case "snippet":
      return {
        Icon: Code,
        label: "Snippet",
        bgColor: "bg-amber-100",
        iconColor: "text-amber-600",
      };
    default:
      return {
        Icon: BookOpen,
        label: "Item",
        bgColor: "bg-slate-100",
        iconColor: "text-slate-600",
      };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
