"use client";

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Users,
  Map,
  Pencil,
  Sparkles,
  Loader2,
  Layers,
  MessageSquare,
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/hooks/use-api";

// Import extracted components from each library
import { OverviewTab as PromptsOverview, BuilderTab as PromptsBuilder } from "../prompt-library/components";
import { OverviewTab as PersonasOverview, PersonasTab, BuilderTab as PersonasBuilder, type InstructionPreset } from "../personas/components";
import TemplatesTab from "../content-manager/components/TemplatesTab";
import FeedbackTab from "../content-manager/components/FeedbackTab";

type LibraryType = "all" | "prompts" | "personas" | "templates";
type SubTab = "overview" | "manage" | "builder" | "feedback";

const LIBRARIES: {
  id: LibraryType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  subTabs: { id: SubTab; label: string; icon: React.ReactNode }[];
}[] = [
  {
    id: "all",
    label: "Overview",
    icon: <Zap className="h-4 w-4" />,
    description: "See how everything works together",
    color: "slate",
    subTabs: [],
  },
  {
    id: "prompts",
    label: "Prompts",
    icon: <Layers className="h-4 w-4" />,
    description: "AI instructions that define behavior",
    color: "blue",
    subTabs: [
      { id: "overview", label: "Overview", icon: <Map className="h-3.5 w-3.5" /> },
      { id: "builder", label: "Builder", icon: <Pencil className="h-3.5 w-3.5" /> },
    ],
  },
  {
    id: "personas",
    label: "Personas",
    icon: <Users className="h-4 w-4" />,
    description: "Custom AI response styles",
    color: "purple",
    subTabs: [
      { id: "overview", label: "Overview", icon: <Map className="h-3.5 w-3.5" /> },
      { id: "manage", label: "Manage", icon: <Pencil className="h-3.5 w-3.5" /> },
      { id: "builder", label: "Builder", icon: <Sparkles className="h-3.5 w-3.5" /> },
    ],
  },
  {
    id: "templates",
    label: "Templates",
    icon: <FileText className="h-4 w-4" />,
    description: "Collateral generation templates",
    color: "green",
    subTabs: [
      { id: "overview", label: "Overview", icon: <Map className="h-3.5 w-3.5" /> },
      { id: "manage", label: "Manage", icon: <Pencil className="h-3.5 w-3.5" /> },
      { id: "feedback", label: "Feedback", icon: <MessageSquare className="h-3.5 w-3.5" /> },
    ],
  },
];

// Unified Overview - How it all fits together
function UnifiedOverview({
  onNavigate
}: {
  onNavigate: (library: LibraryType, tab?: SubTab) => void
}) {
  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Big picture */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">How It All Fits Together</h2>
          <p className="text-sm text-slate-600 mb-4">
            Three libraries work together to create AI-powered content. Prompts are required, while Personas and Templates are optional enhancements.
          </p>

          {/* Visual flow */}
          <div className="flex items-center justify-center gap-2 py-6 bg-gradient-to-r from-slate-50 via-white to-slate-50 rounded-lg">
            <button
              onClick={() => onNavigate("prompts")}
              className="flex flex-col items-center p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md transition-all group"
            >
              <Layers className="h-8 w-8 text-blue-600 mb-2" />
              <span className="font-semibold text-blue-900">Prompts</span>
              <span className="text-xs text-blue-600">What AI knows</span>
              <span className="text-[10px] text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to explore</span>
            </button>

            <ArrowRight className="h-5 w-5 text-slate-300" />
            <span className="text-slate-400 text-lg">+</span>
            <ArrowRight className="h-5 w-5 text-slate-300" />

            <button
              onClick={() => onNavigate("personas")}
              className="flex flex-col items-center p-4 rounded-lg border-2 border-purple-200 bg-purple-50 hover:border-purple-400 hover:shadow-md transition-all group relative"
            >
              <span className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full border border-purple-200">Optional</span>
              <Users className="h-8 w-8 text-purple-600 mb-2" />
              <span className="font-semibold text-purple-900">Personas</span>
              <span className="text-xs text-purple-600">How AI responds</span>
              <span className="text-[10px] text-purple-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to explore</span>
            </button>

            <ArrowRight className="h-5 w-5 text-slate-300" />
            <span className="text-slate-400 text-lg">+</span>
            <ArrowRight className="h-5 w-5 text-slate-300" />

            <button
              onClick={() => onNavigate("templates")}
              className="flex flex-col items-center p-4 rounded-lg border-2 border-green-200 bg-green-50 hover:border-green-400 hover:shadow-md transition-all group relative"
            >
              <span className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full border border-green-200">Optional</span>
              <FileText className="h-8 w-8 text-green-600 mb-2" />
              <span className="font-semibold text-green-900">Templates</span>
              <span className="text-xs text-green-600">Output structure</span>
              <span className="text-[10px] text-green-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to explore</span>
            </button>

            <ArrowRight className="h-5 w-5 text-slate-300" />
            <span className="text-slate-400 text-lg">=</span>
            <ArrowRight className="h-5 w-5 text-slate-300" />

            <div className="flex flex-col items-center p-4 rounded-lg border-2 border-amber-200 bg-amber-50">
              <Zap className="h-8 w-8 text-amber-600 mb-2" />
              <span className="font-semibold text-amber-900">AI Output</span>
              <span className="text-xs text-amber-600">Generated content</span>
            </div>
          </div>
        </div>

        {/* Three cards with descriptions and quick actions */}
        <div className="grid grid-cols-3 gap-4">
          {/* Prompts */}
          <div className="bg-white rounded-lg border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Prompts</h3>
                <p className="text-xs text-slate-500">AI Instructions</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Reusable blocks that tell the AI what it knows, how to prioritize sources, and how to format responses.
            </p>
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Blocks combine into prompts
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Variants per feature (chat, RFP, etc.)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-purple-600">Includes <code className="bg-purple-50 px-1 rounded">{"{{persona}}"}</code> placeholder</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate("prompts", "builder")}
              className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 pt-2 border-t"
            >
              Open Builder <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Personas */}
          <div className="bg-white rounded-lg border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Personas</h3>
                <p className="text-xs text-slate-500">Response Styles</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Custom instructions that shape AI tone and behavior. Like different &quot;modes&quot; users can switch between.
            </p>
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                Injected into prompts at runtime
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                User-selectable in chat
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-green-600">Can be linked to templates</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate("personas", "manage")}
              className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center justify-center gap-1 pt-2 border-t"
            >
              Manage Personas <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Templates */}
          <div className="bg-white rounded-lg border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-100">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Templates</h3>
                <p className="text-xs text-slate-500">Output Structure</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Pre-built content structures for sales collateral. Define sections and placeholders for AI to fill.
            </p>
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Sales decks, one-pagers, emails
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Placeholders for dynamic content
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-purple-600">Can auto-select a persona</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate("templates", "manage")}
              className="w-full text-sm text-green-600 hover:text-green-700 font-medium flex items-center justify-center gap-1 pt-2 border-t"
            >
              Manage Templates <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Type for template list items
type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  outputFormat: string;
  isActive: boolean;
  instructionPresetId: string | null;
};

// Templates Overview content - stats and quick actions
function TemplatesOverview({
  templates,
  onNavigate
}: {
  templates: TemplateListItem[];
  onNavigate: (library: LibraryType, tab?: SubTab) => void
}) {
  // Stats
  const totalTemplates = templates.length;
  const activeCount = templates.filter(t => t.isActive).length;
  const inactiveCount = templates.filter(t => !t.isActive).length;
  const withPersonaCount = templates.filter(t => t.instructionPresetId).length;

  // Group by category
  const categoryCounts = templates.reduce((acc, t) => {
    const cat = t.category || "Uncategorized";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{totalTemplates}</div>
                <div className="text-sm text-slate-500">Total Templates</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{activeCount}</div>
                <div className="text-sm text-slate-500">Active</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <FileText className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{inactiveCount}</div>
                <div className="text-sm text-slate-500">Inactive</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{withPersonaCount}</div>
                <div className="text-sm text-slate-500">With Persona</div>
              </div>
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Template list */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">All Templates</h3>
              <span className="text-xs text-slate-400">{totalTemplates} total</span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {templates.length > 0 ? (
                templates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{template.name}</span>
                      {template.instructionPresetId && (
                        <Users className="h-3 w-3 text-purple-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {template.category && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-500">
                          {template.category}
                        </span>
                      )}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          template.isActive ? "bg-green-500" : "bg-slate-300"
                        }`}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 italic py-4 text-center">
                  No templates created yet
                </p>
              )}
            </div>
          </div>

          {/* Right: Categories */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold text-slate-800 mb-4">By Category</h3>
            <div className="space-y-2">
              {Object.entries(categoryCounts).length > 0 ? (
                Object.entries(categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50"
                    >
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {category}
                      </span>
                      <span className="text-sm text-slate-500">{count} template{count !== 1 ? "s" : ""}</span>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-slate-400 italic py-4 text-center">
                  No categories yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">Build a new template</div>
              <div className="text-sm text-slate-500">Use AI to help structure your template</div>
            </div>
            <Link
              href="/admin/templates/build"
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Sparkles className="h-4 w-4" /> Build
            </Link>
          </div>
          <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">Manage templates</div>
              <div className="text-sm text-slate-500">Edit, upload, or delete templates</div>
            </div>
            <button
              onClick={() => onNavigate("templates", "manage")}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Manage <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LibrariesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialLibrary = (searchParams.get("library") as LibraryType) || "all";
  const initialSubTab = (searchParams.get("tab") as SubTab) || "overview";

  const [activeLibrary, setActiveLibrary] = useState<LibraryType>(initialLibrary);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(initialSubTab);

  // Fetch presets for personas overview
  const { data: presetsData } = useApiQuery<{ presets: InstructionPreset[] }>({
    url: "/api/instruction-presets",
    queryKey: ["instruction-presets"],
  });
  const presets = presetsData?.presets || [];

  // Fetch templates for templates overview
  const { data: templatesData } = useApiQuery<TemplateListItem[]>({
    url: "/api/templates",
    queryKey: ["admin-templates"],
    params: { activeOnly: false },
    transform: (data) => (Array.isArray(data) ? data : []),
  });
  const templates = templatesData || [];

  // Check for admin access
  const userCapabilities = session?.user?.capabilities || [];
  const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") ||
    userCapabilities.includes("ADMIN") ||
    (session?.user as { role?: string })?.role === "ADMIN" ||
    (session?.user as { role?: string })?.role === "PROMPT_ADMIN";

  const handleLibraryChange = (library: LibraryType, tab?: SubTab) => {
    setActiveLibrary(library);
    const newTab = tab || (library === "all" ? "overview" : "overview");
    setActiveSubTab(newTab);
    router.push(`/admin/libraries?library=${library}&tab=${newTab}`, { scroll: false });
  };

  const handleSubTabChange = (tab: SubTab) => {
    setActiveSubTab(tab);
    router.push(`/admin/libraries?library=${activeLibrary}&tab=${tab}`, { scroll: false });
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-red-600 mb-4 text-xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You need admin permissions to access this page.</p>
        <Link href="/" className="text-primary mt-4 block">Go Home</Link>
      </div>
    );
  }

  const currentLibrary = LIBRARIES.find(l => l.id === activeLibrary)!;

  // Render the appropriate content based on library and tab
  const renderContent = () => {
    if (activeLibrary === "all") {
      return <UnifiedOverview onNavigate={handleLibraryChange} />;
    }

    if (activeLibrary === "prompts") {
      if (activeSubTab === "overview") return <PromptsOverview />;
      if (activeSubTab === "builder") return <PromptsBuilder />;
    }

    if (activeLibrary === "personas") {
      if (activeSubTab === "overview") return <PersonasOverview presets={presets} />;
      if (activeSubTab === "manage") return <PersonasTab />;
      if (activeSubTab === "builder") return <PersonasBuilder onPresetSaved={() => handleSubTabChange("manage")} />;
    }

    if (activeLibrary === "templates") {
      if (activeSubTab === "overview") return <TemplatesOverview templates={templates} onNavigate={handleLibraryChange} />;
      if (activeSubTab === "manage") return <TemplatesTab />;
      if (activeSubTab === "feedback") return <FeedbackTab />;
    }

    return null;
  };

  return (
    <div className="flex flex-col" style={{ height: "100dvh", minHeight: "100vh" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-background flex-shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold mb-1">Libraries</h1>
            <p className="text-muted-foreground text-sm">
              Manage AI prompts, personas, and collateral templates
            </p>
          </div>
        </div>

        {/* Primary Library Tabs */}
        <div className="flex gap-1 mt-4">
          {LIBRARIES.map((lib) => (
            <button
              key={lib.id}
              onClick={() => handleLibraryChange(lib.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2",
                activeLibrary === lib.id
                  ? lib.color === "blue" ? "bg-blue-50 text-blue-700 border-blue-500" :
                    lib.color === "purple" ? "bg-purple-50 text-purple-700 border-purple-500" :
                    lib.color === "green" ? "bg-green-50 text-green-700 border-green-500" :
                    "bg-slate-100 text-slate-700 border-slate-500"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
              )}
            >
              {lib.icon}
              {lib.label}
            </button>
          ))}
        </div>

        {/* Sub Tabs - only show for non-"all" libraries */}
        {activeLibrary !== "all" && currentLibrary.subTabs.length > 0 && (
          <div className="flex gap-1 mt-2 ml-4 border-l-2 border-slate-200 pl-4">
            {currentLibrary.subTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSubTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeSubTab === tab.id
                    ? "bg-slate-200 text-slate-900"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {renderContent()}
      </div>
    </div>
  );
}

export default function LibrariesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    }>
      <LibrariesContent />
    </Suspense>
  );
}
