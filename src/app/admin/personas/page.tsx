"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Sparkles,
  Users,
  Map,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/hooks/use-api";
import { OverviewTab, PersonasTab, BuilderTab, type InstructionPreset } from "./components";

type TabType = "overview" | "personas" | "builder";

export default function PersonasPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Fetch presets for overview
  const { data: presetsData } = useApiQuery<{ presets: InstructionPreset[] }>({
    url: "/api/instruction-presets",
    queryKey: ["instruction-presets"],
  });

  const presets = presetsData?.presets || [];

  // Check for admin access
  const userCapabilities = session?.user?.capabilities || [];
  const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") ||
    userCapabilities.includes("ADMIN") ||
    (session?.user as { role?: string })?.role === "ADMIN" ||
    (session?.user as { role?: string })?.role === "PROMPT_ADMIN";

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-slate-500">You need admin permissions to access this page.</p>
        <Link href="/" className="text-blue-500 mt-4">Go Home</Link>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Map className="h-4 w-4" /> },
    { id: "personas", label: "Personas", icon: <Users className="h-4 w-4" /> },
    { id: "builder", label: "Builder", icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Persona Library</h1>
            <p className="text-sm text-slate-500">Custom AI personas that shape how the assistant responds</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "overview" && <OverviewTab presets={presets} />}
      {activeTab === "personas" && <PersonasTab />}
      {activeTab === "builder" && <BuilderTab onPresetSaved={() => setActiveTab("personas")} />}
    </div>
  );
}
