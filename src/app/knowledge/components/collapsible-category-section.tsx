"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleCategorySectionProps {
  categoryName: string;
  itemCount: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function CollapsibleCategorySection({
  categoryName,
  itemCount,
  children,
  defaultExpanded = true,
}: CollapsibleCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
          "bg-muted/50 hover:bg-muted text-sm font-medium text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left">{categoryName}</span>
        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
          {itemCount}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-3 pl-2">
          {children}
        </div>
      )}
    </div>
  );
}
