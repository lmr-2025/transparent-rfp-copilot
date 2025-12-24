"use client";

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Map, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverviewTab, BuilderTab } from "./components";

type TabType = "overview" | "builder";

function PromptLibraryContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || "overview");

  // Handle tab change with URL sync
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/admin/prompt-library?tab=${tab}`, { scroll: false });
  };

  const userCapabilities = session?.user?.capabilities || [];
  const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") || userCapabilities.includes("ADMIN");

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
        <Link href="/" className="text-blue-600 hover:underline">Go Home</Link>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Map className="h-4 w-4" /> },
    { id: "builder", label: "Builder", icon: <Pencil className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col font-sans" style={{ height: "100dvh", minHeight: "100vh" }}>
      {/* Header with Tabs */}
      <div className="h-14 border-b bg-white flex items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold">Prompt Library</h1>
          {/* Tab Navigation */}
          <div className="flex items-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" ? <OverviewTab /> : <BuilderTab />}
    </div>
  );
}

export default function PromptBuilderV5Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <PromptLibraryContent />
    </Suspense>
  );
}
