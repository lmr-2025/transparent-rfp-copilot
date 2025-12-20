"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ChevronDown, ChevronUp, ChevronRight, BookOpen, FileText, Globe, Code, User, ExternalLink, History, UserCog, CheckSquare, Square, RefreshCw, Tag, Wand2, Link2, Pencil, Check, X, GitBranch, AlertTriangle, Save } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UnifiedLibraryItem, LibraryItemType, SkillOwner, RefreshResult } from "@/hooks/use-knowledge-data";
import { OwnerManagementDialog } from "./owner-management-dialog";
import { SkillRefreshDialog } from "./skill-refresh-dialog";
import { CategoryManagementDialog } from "./category-management-dialog";
import { SkillSourcesDialog } from "./skill-sources-dialog";
import { SkillHistoryDialog } from "./skill-history-dialog";
import { SkillSyncLogsDialog } from "@/components/knowledge/skill-sync-logs-dialog";
import { SyncStatusBadge } from "@/components/ui/sync-status-badge";

interface KnowledgeItemCardProps {
  item: UnifiedLibraryItem;
  onDelete?: () => void;
  isDeleting?: boolean;
  onUpdateOwners?: (id: string, owners: SkillOwner[]) => Promise<void>;
  onUpdateContent?: (id: string, title: string, content: string) => Promise<void>;
  onRefresh?: (id: string) => Promise<RefreshResult>;
  onApplyRefresh?: (id: string, title: string, content: string, changeHighlights?: string[]) => Promise<void>;
  onUpdateCategories?: (id: string, categories: string[]) => Promise<void>;
  onUpdateTitle?: (id: string, newTitle: string) => Promise<void>;
  isRefreshing?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  linkedSkillName?: string; // Name of linked skill (for sources)
  onClose?: () => void; // Close handler for modal/overlay usage
}

export function KnowledgeItemCard({
  item,
  onDelete,
  isDeleting,
  onUpdateOwners,
  onUpdateContent,
  onRefresh,
  onApplyRefresh,
  onUpdateCategories,
  onUpdateTitle,
  isRefreshing,
  selectionMode,
  isSelected,
  onToggleSelection,
  linkedSkillName,
  onClose,
}: KnowledgeItemCardProps) {
  const router = useRouter();
  // Start expanded when displayed in modal (onClose is provided)
  const [isExpanded, setIsExpanded] = useState(!!onClose);
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
  // Collapsible sections within expanded view
  const [showContent, setShowContent] = useState(true);
  const [showUrls, setShowUrls] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Content editing state
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState(item.content || "");
  const [editedSkillTitle, setEditedSkillTitle] = useState(item.title);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);

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

  // Skills can be edited inline
  const canEditContent = item.type === "skill" && onUpdateContent && !selectionMode;

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

  const handleCancelTitleEdit = () => {
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

  const handleStartEdit = () => {
    setEditedContent(item.content || "");
    setEditedSkillTitle(item.title);
    setShowEditWarning(true);
  };

  const handleConfirmEdit = () => {
    setShowEditWarning(false);
    setIsEditingContent(true);
  };

  const handleCancelContentEdit = () => {
    setIsEditingContent(false);
    setShowEditWarning(false);
    setEditedContent(item.content || "");
    setEditedSkillTitle(item.title);
  };

  const handleSaveContent = async () => {
    if (!onUpdateContent) return;
    if (editedContent === item.content && editedSkillTitle === item.title) {
      setIsEditingContent(false);
      return;
    }
    setIsSavingContent(true);
    try {
      await onUpdateContent(item.id, editedSkillTitle, editedContent);
      setIsEditingContent(false);
    } finally {
      setIsSavingContent(false);
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
        "group",
        !item.isActive && item.type === "skill" && "opacity-60",
        selectionMode && "cursor-pointer hover:border-blue-400",
        isSelected && "border-blue-500 bg-blue-50/50"
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-3">
        {/* Compact single-row header */}
        <div className="flex items-center gap-2">
          {/* Selection checkbox */}
          {selectionMode && (
            <div className="flex-shrink-0">
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-blue-600" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Type icon */}
          <div className={cn("p-1.5 rounded flex-shrink-0", typeConfig.bgColor)}>
            <typeConfig.Icon className={cn("h-3.5 w-3.5", typeConfig.iconColor)} />
          </div>

          {/* Title section */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isEditingTitle ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="flex-1 px-2 py-0.5 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") handleCancelTitleEdit();
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle}
                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                >
                  {isSavingTitle ? <InlineLoader size="sm" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelTitleEdit}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <h3 className="font-medium text-sm text-foreground truncate">{item.title}</h3>
                {canEditTitle && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingTitle(true)}
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Inline badges */}
          {item.type === "skill" && !item.isActive && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
              Inactive
            </span>
          )}
          {item.type === "skill" && (
            <SyncStatusBadge
              status={item.syncStatus ?? null}
              lastSyncedAt={item.lastSyncedAt}
              showLabel={false}
              variant="icon-only"
            />
          )}

          {/* Categories (first 2 only in collapsed view) */}
          {item.categories && item.categories.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
              {item.categories.slice(0, 2).map((cat) => (
                <span key={cat} className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                  {cat}
                </span>
              ))}
              {item.categories.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{item.categories.length - 2}</span>
              )}
            </div>
          )}

          {/* Metadata badges */}
          <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground flex-shrink-0">
            {item.owners && item.owners.length > 0 && (
              <span className="flex items-center gap-0.5" title={item.owners.map((o) => o.name).join(", ")}>
                <User className="h-3 w-3" />
                {item.owners.length}
              </span>
            )}
            {item.type === "skill" && item.sourceUrls && item.sourceUrls.length > 0 && (
              <span className="flex items-center gap-0.5" title={`${item.sourceUrls.length} sources`}>
                <Globe className="h-3 w-3" />
                {item.sourceUrls.length}
              </span>
            )}
            {linkedSkillName && (
              <span className="flex items-center gap-0.5 text-blue-600" title={`Linked to: ${linkedSkillName}`}>
                <Link2 className="h-3 w-3" />
              </span>
            )}
          </div>

          {/* Date */}
          <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden lg:block">
            {new Date(item.updatedAt).toLocaleDateString()}
          </span>

          {/* Expand/collapse button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="h-6 w-6 p-0 flex-shrink-0"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {/* Close button for modal/overlay usage */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="h-6 w-6 p-0 flex-shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Subtitle row (only if present) */}
        {item.subtitle && !isExpanded && (
          <p className="text-xs text-muted-foreground truncate mt-1 ml-8">{item.subtitle}</p>
        )}

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            {/* Edit Warning Dialog */}
            {showEditWarning && (
              <div className="border border-amber-300 rounded-lg overflow-hidden bg-amber-50">
                <div className="px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-amber-800">Edit Skill Content</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Manual edits will override AI-generated content and may affect how this skill is matched to questionnaire questions.
                      This action is typically reserved for administrators.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={handleConfirmEdit}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        I Understand, Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelContentEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content section - collapsible */}
            {item.content && !showEditWarning && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowContent(!showContent)}
                  className="w-full px-3 py-2 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Content
                    {isEditingContent && <span className="text-amber-600 normal-case">(Editing)</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/70">{(isEditingContent ? editedContent : item.content).length.toLocaleString()} chars</span>
                    {showContent ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {showContent && (
                  <div className="bg-muted/20">
                    {isEditingContent ? (
                      <div className="p-3 space-y-3">
                        {/* Title editing */}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Title</label>
                          <input
                            type="text"
                            value={editedSkillTitle}
                            onChange={(e) => setEditedSkillTitle(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {/* Content editing */}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Content</label>
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans min-h-[200px] resize-y"
                            placeholder="Enter skill content..."
                          />
                        </div>
                        {/* Save/Cancel buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                          <Button
                            size="sm"
                            onClick={handleSaveContent}
                            disabled={isSavingContent}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isSavingContent ? (
                              <InlineLoader size="sm" className="mr-1" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            Save Changes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelContentEdit}
                            disabled={isSavingContent}
                          >
                            Cancel
                          </Button>
                          {(editedContent !== item.content || editedSkillTitle !== item.title) && (
                            <span className="text-xs text-amber-600 ml-2">Unsaved changes</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <pre className="text-sm text-foreground whitespace-pre-wrap font-sans max-h-80 overflow-y-auto p-3">
                        {item.content}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Source URLs section - collapsible (skills only) */}
            {item.type === "skill" && item.sourceUrls && item.sourceUrls.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowUrls(!showUrls)}
                  className="w-full px-3 py-2 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    Source URLs
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/70">{item.sourceUrls.length}</span>
                    {showUrls ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {showUrls && (
                  <ul className="p-3 space-y-2 bg-muted/20">
                    {item.sourceUrls.map((src, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate flex items-center gap-1 flex-1 min-w-0"
                        >
                          <span className="truncate">{src.url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(src.addedAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* History section - collapsible (skills only) */}
            {item.type === "skill" && item.history && item.history.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full px-3 py-2 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <History className="h-3.5 w-3.5" />
                    History
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/70">{item.history.length} entries</span>
                    {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {showHistory && (
                  <ul className="p-3 space-y-2 bg-muted/20 max-h-48 overflow-y-auto">
                    {item.history.slice(0, 20).map((entry, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-medium flex-shrink-0">{new Date(entry.date).toLocaleDateString()}</span>
                        <span className="px-1.5 py-0.5 bg-muted rounded text-xs flex-shrink-0">{entry.action}</span>
                        <span className="truncate flex-1">{entry.summary}</span>
                        {entry.user && <span className="text-muted-foreground/70 flex-shrink-0">by {entry.user}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Document details */}
            {item.type === "document" && (item.filename || item.fileSize) && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                {item.filename && <span>{item.filename}</span>}
                {item.fileSize && <span>{formatFileSize(item.fileSize)}</span>}
                {item.fileType && <span className="uppercase">{item.fileType}</span>}
              </div>
            )}

            {/* Snippet key */}
            {item.type === "snippet" && item.snippetKey && (
              <div className="text-xs text-muted-foreground px-1">
                <span className="font-medium">Key: </span>
                <code className="bg-muted px-1.5 py-0.5 rounded">{`{{${item.snippetKey}}}`}</code>
              </div>
            )}

            {/* Admin actions - moved inside expanded section */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/50 flex-wrap">
              {canEditContent && !isEditingContent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartEdit}
                  className="h-7 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit Content
                </Button>
              )}
              {canRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshClick}
                  disabled={isRefreshing}
                  className="h-7 text-xs"
                >
                  {isRefreshing ? (
                    <InlineLoader size="sm" className="mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Refresh
                </Button>
              )}
              {canManageCategories && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCategoryDialog(true)}
                  className="h-7 text-xs"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  Categories
                </Button>
              )}
              {canManageOwners && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOwnerDialog(true)}
                  className="h-7 text-xs"
                >
                  <UserCog className="h-3 w-3 mr-1" />
                  Owners
                </Button>
              )}
              {item.type === "skill" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSyncLogsDialog(true)}
                  className="h-7 text-xs"
                >
                  <GitBranch className="h-3 w-3 mr-1" />
                  Sync Logs
                </Button>
              )}
              {canConvertToSkill && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConvertToSkill}
                  className="h-7 text-xs"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Convert to Skill
                </Button>
              )}
              {/* Spacer to push delete to the right */}
              <div className="flex-1" />
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {isDeleting ? (
                    <InlineLoader size="sm" className="mr-1" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}

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
