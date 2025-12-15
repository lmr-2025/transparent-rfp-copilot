"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, BookOpen, FileText, Globe, Code, Loader2, User, ExternalLink, History, UserCog, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UnifiedLibraryItem, LibraryItemType, SkillOwner } from "@/hooks/use-knowledge-data";
import { OwnerManagementDialog } from "./owner-management-dialog";

interface KnowledgeItemCardProps {
  item: UnifiedLibraryItem;
  onDelete?: () => void;
  isDeleting?: boolean;
  onUpdateOwners?: (id: string, owners: SkillOwner[]) => Promise<void>;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

export function KnowledgeItemCard({
  item,
  onDelete,
  isDeleting,
  onUpdateOwners,
  selectionMode,
  isSelected,
  onToggleSelection,
}: KnowledgeItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);

  const typeConfig = getTypeConfig(item.type);

  // Only skills support owner management
  const canManageOwners = item.type === "skill" && onUpdateOwners;

  const handleSaveOwners = async (owners: SkillOwner[]) => {
    if (onUpdateOwners) {
      await onUpdateOwners(item.id, owners);
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
        "transition-all",
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
                <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                {item.type === "skill" && !item.isActive && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    Inactive
                  </span>
                )}
              </div>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
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
            {canManageOwners && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOwnerDialog(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
                title="Manage owners"
              >
                <UserCog className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
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
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Content</h4>
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans max-h-64 overflow-y-auto bg-muted/50 p-3 rounded-md">
                  {item.content.length > 1500
                    ? item.content.slice(0, 1500) + "..."
                    : item.content}
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
