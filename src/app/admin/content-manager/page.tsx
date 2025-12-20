"use client";

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, MessageSquare, Map } from "lucide-react";
import TemplatesTab from "./components/TemplatesTab";
import FeedbackTab from "./components/FeedbackTab";

type TabId = "overview" | "templates" | "feedback";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Map size={16} /> },
  { id: "templates", label: "Templates", icon: <FileText size={16} /> },
  { id: "feedback", label: "Feedback", icon: <MessageSquare size={16} /> },
];

// Features that use templates
const templateFeatures = [
  {
    id: "collateral",
    name: "Collateral Generation",
    description: "Create sales decks, one-pagers, and presentations",
    templates: ["Sales Deck", "One-Pager", "Case Study", "ROI Calculator"],
  },
  {
    id: "emails",
    name: "Email Templates",
    description: "Outreach and follow-up email templates",
    templates: ["Introduction", "Follow-up", "Proposal", "Thank You"],
  },
];

function OverviewTab() {
  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Educational intro */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">What are Templates?</h2>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              <strong>Templates</strong> are pre-built content structures for generating sales collateral.
              They define the sections, formatting, and placeholders that get filled in with customer-specific information.
            </p>
            <p>
              When you generate a sales deck or one-pager, the AI uses a template to structure the output,
              then fills it with relevant content from your knowledge base and customer profiles.
            </p>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-4">
          {templateFeatures.map((feature) => (
            <div key={feature.id} className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-1">{feature.name}</h3>
              <p className="text-sm text-slate-500 mb-3">{feature.description}</p>
              <div className="flex flex-wrap gap-2">
                {feature.templates.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="font-semibold text-slate-800 mb-3">How Templates Work</h3>
          <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-3">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Template</span>
            <span>+</span>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">Customer Profile</span>
            <span>+</span>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">Knowledge Base</span>
            <span>=</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">Generated Collateral</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateLibraryContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "overview";
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
    <div className="flex flex-col" style={{ height: "100dvh", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-background flex-shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold mb-1">
              Template Library
            </h1>
            <p className="text-muted-foreground text-sm">
              Collateral templates and user feedback
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
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "feedback" && <FeedbackTab />}
      </div>
    </div>
  );
}

export default function TemplateLibraryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading...
      </div>
    }>
      <TemplateLibraryContent />
    </Suspense>
  );
}
