"use client";

import { cn } from "@/lib/utils";
import { BookOpen, FileText, Globe, Code } from "lucide-react";

export type TabType = "skills" | "documents" | "urls" | "snippets";

interface LibraryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts: {
    skills: number;
    documents: number;
    urls: number;
    snippets: number;
  };
}

export function LibraryTabs({ activeTab, onTabChange, counts }: LibraryTabsProps) {
  const tabs: { key: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "skills", label: "Skills", icon: <BookOpen className="h-4 w-4" />, count: counts.skills },
    { key: "documents", label: "Documents", icon: <FileText className="h-4 w-4" />, count: counts.documents },
    { key: "urls", label: "URLs", icon: <Globe className="h-4 w-4" />, count: counts.urls },
    { key: "snippets", label: "Snippets", icon: <Code className="h-4 w-4" />, count: counts.snippets },
  ];

  return (
    <div className="flex border-b border-border">
      {tabs.map(({ key, label, icon, count }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
          )}
        >
          {icon}
          {label}
          <span
            className={cn(
              "px-1.5 py-0.5 text-xs rounded-full",
              activeTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {count}
          </span>
        </button>
      ))}
    </div>
  );
}
