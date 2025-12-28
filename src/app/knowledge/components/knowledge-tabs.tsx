"use client";

import { cn } from "@/lib/utils";
import { BookOpen, FolderOpen, LayoutDashboard } from "lucide-react";

export type TabType = "skills" | "sources" | "dashboard";

interface LibraryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts: {
    skills: number;
    sources: number;
  };
}

export function LibraryTabs({ activeTab, onTabChange, counts }: LibraryTabsProps) {
  const tabs: { key: TabType; label: string; icon: React.ReactNode; count?: number; description: string }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, description: "Overview & guide" },
    { key: "skills", label: "Skills", icon: <BookOpen className="h-4 w-4" />, count: counts.skills, description: "Structured knowledge for Q&A" },
    { key: "sources", label: "Sources", icon: <FolderOpen className="h-4 w-4" />, count: counts.sources, description: "Documents & URLs" },
  ];

  return (
    <div className="flex border-b border-border">
      {tabs.map(({ key, label, icon, count, description }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
          )}
          title={description}
        >
          {icon}
          {label}
          {count !== undefined && (
            <span
              className={cn(
                "px-1.5 py-0.5 text-xs rounded-full",
                activeTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
