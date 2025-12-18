"use client";

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, User, MessageSquare } from "lucide-react";
import PresetsTab from "@/app/chat/instruction-presets/components/PresetsTab";
import BuilderTab from "@/app/chat/instruction-presets/components/BuilderTab";
import TemplatesTab from "./components/TemplatesTab";
import FeedbackTab from "./components/FeedbackTab";

type TabId = "personas" | "persona-builder" | "templates" | "feedback";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "personas", label: "Personas", icon: <User size={16} /> },
  { id: "persona-builder", label: "Persona Builder", icon: <User size={16} /> },
  { id: "templates", label: "Templates", icon: <FileText size={16} /> },
  { id: "feedback", label: "Feedback", icon: <MessageSquare size={16} /> },
];

function ContentManagerContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "personas";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Check for prompt management access using capabilities (with legacy fallback)
  const userCapabilities = session?.user?.capabilities || [];
  const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") ||
    userCapabilities.includes("ADMIN") ||
    (session?.user as { role?: string })?.role === "ADMIN" ||
    (session?.user as { role?: string })?.role === "PROMPT_ADMIN";

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    router.push(`/admin/content-manager?tab=${tab}`, { scroll: false });
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-red-600 mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You need admin permissions to access this page.</p>
        <Link href="/" className="text-primary">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-background flex-shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold mb-1">
              Content Manager
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage personas, templates, and review feedback
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "personas" && <PresetsTab />}
        {activeTab === "persona-builder" && (
          <BuilderTab onPresetSaved={() => handleTabChange("personas")} />
        )}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "feedback" && <FeedbackTab />}
      </div>
    </div>
  );
}

export default function ContentManagerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading...
      </div>
    }>
      <ContentManagerContent />
    </Suspense>
  );
}
