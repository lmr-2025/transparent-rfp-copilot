"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KnowledgeSourceListProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; label: string }>;
  selections: Map<string, boolean>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onSelectNone: () => void;
  emptyMessage?: string;
}

export function KnowledgeSourceList({
  title,
  icon,
  items,
  selections,
  onToggle,
  onSelectAll,
  onSelectNone,
  emptyMessage = "No items available",
}: KnowledgeSourceListProps) {
  const selectedCount = Array.from(selections.values()).filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {icon}
            {title}
            <span className="text-muted-foreground">
              ({selectedCount}/{items.length})
            </span>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => onSelectAll(items.map((item) => item.id))}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={onSelectNone}
            >
              None
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4 max-h-48 overflow-y-auto">
        <div className="space-y-1">
          {items.map((item) => (
            <SelectableItem
              key={item.id}
              label={item.label}
              selected={selections.get(item.id) || false}
              onClick={() => onToggle(item.id)}
            />
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SelectableItemProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function SelectableItem({ label, selected, onClick }: SelectableItemProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${label}${selected ? " (selected)" : ""}`}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
        selected
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-foreground"
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center",
          selected
            ? "bg-primary border-primary text-primary-foreground"
            : "border-input"
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>
      <span className="truncate">{label}</span>
    </button>
  );
}
