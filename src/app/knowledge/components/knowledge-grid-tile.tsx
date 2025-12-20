"use client";

import { BookOpen, FileText, Globe, Code, CheckSquare, Square, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UnifiedLibraryItem, LibraryItemType } from "@/hooks/use-knowledge-data";
import { SyncStatusBadge } from "@/components/ui/sync-status-badge";

interface KnowledgeGridTileProps {
  item: UnifiedLibraryItem;
  onClick?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

export function KnowledgeGridTile({
  item,
  onClick,
  selectionMode,
  isSelected,
  onToggleSelection,
}: KnowledgeGridTileProps) {
  const typeConfig = getTypeConfig(item.type);

  const handleClick = () => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection();
    } else if (onClick) {
      onClick();
    }
  };

  // Format relative time
  const formatRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  // Get primary category (first one, shortened if needed)
  const primaryCategory = item.categories?.[0];

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group relative flex flex-col h-full",
        !item.isActive && item.type === "skill" && "opacity-60",
        selectionMode && "hover:border-blue-400",
        isSelected && "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
      )}
      onClick={handleClick}
    >
      {/* Selection checkbox overlay */}
      {selectionMode && (
        <div className="absolute top-2 right-2 z-10">
          {isSelected ? (
            <CheckSquare className="h-5 w-5 text-blue-600" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Header row: icon + sync status */}
      <div className="flex items-center justify-between mb-2">
        <div className={cn("p-1.5 rounded-md", typeConfig.bgColor)}>
          <typeConfig.Icon className={cn("h-3.5 w-3.5", typeConfig.iconColor)} />
        </div>
        {item.type === "skill" && (
          <SyncStatusBadge
            status={item.syncStatus ?? null}
            lastSyncedAt={item.lastSyncedAt}
            showLabel={false}
            variant="icon-only"
          />
        )}
      </div>

      {/* Title - fixed height for consistency */}
      <h3 className="font-medium text-sm text-foreground line-clamp-2 mb-auto leading-snug">
        {item.title}
      </h3>

      {/* Footer: category + metadata */}
      <div className="mt-3 pt-2 border-t border-border/40">
        {/* Category badge */}
        {primaryCategory && (
          <div className="mb-2">
            <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground inline-block max-w-full truncate">
              {primaryCategory}
            </span>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{typeConfig.label}</span>
          <div className="flex items-center gap-2">
            {item.type === "skill" && item.sourceUrls && item.sourceUrls.length > 0 && (
              <span className="flex items-center gap-0.5">
                <ExternalLink className="h-2.5 w-2.5" />
                {item.sourceUrls.length}
              </span>
            )}
            <span>{formatRelativeTime(item.updatedAt)}</span>
          </div>
        </div>
      </div>
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
        label: "URL",
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
