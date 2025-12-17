"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";

import { parseApiData } from "@/lib/apiClient";
import {
  BrandingTab,
  IntegrationsTab,
  LLMSpeedTab,
  RateLimitsTab,
  CategoriesTab,
  UsageTab,
  AuditTab,
  BrandingSettings,
  SettingsResponse,
  TABS,
  TabId,
  INTEGRATIONS,
} from "./components";

function AdminSettingsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>({
    appName: "Transparent Trust",
    tagline: "Turn your knowledge into trustworthy answers. An LLM-powered assistant telling you not just the answer, but why.",
    sidebarSubtitle: "Transparent LLM Assistant",
    primaryColor: "#0ea5e9",
  });
  const [savingBranding, setSavingBranding] = useState(false);

  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabId>(
    (TABS.find(t => t.id === tabParam)?.id) || "branding"
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth/signin");
      return;
    }
    fetchSettings();
  }, [session, status, router]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.status === 403) {
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch settings");
      const json = await res.json();
      const data = parseApiData<SettingsResponse>(json);
      setSettings(data);
      if (data.branding) {
        setBranding(data.branding);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "branding", value: JSON.stringify(branding) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save branding");
      }
      toast.success("Branding saved! Changes will appear on next page load.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveIntegration = async (integrationKey: string, values: Record<string, string>) => {
    const config = INTEGRATIONS[integrationKey];
    for (const envVar of config.envVars) {
      const value = values[envVar.key];
      if (value !== undefined && value !== "") {
        const res = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: envVar.key, value }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save");
        }
      }
    }
    fetchSettings();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse text-gray-500">Loading settings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Configure branding, integrations, and monitor system activity</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === "branding" && (
            <BrandingTab
              branding={branding}
              setBranding={setBranding}
              onSave={handleSaveBranding}
              saving={savingBranding}
            />
          )}
          {activeTab === "integrations" && (
            <IntegrationsTab settings={settings} onSave={handleSaveIntegration} />
          )}
          {activeTab === "llm-speed" && <LLMSpeedTab />}
          {activeTab === "rate-limits" && <RateLimitsTab />}
          {activeTab === "categories" && <CategoriesTab />}
          {activeTab === "usage" && <UsageTab />}
          {activeTab === "audit" && <AuditTab />}
        </div>

        {/* Security Note */}
        {(activeTab === "branding" || activeTab === "integrations") && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-medium text-amber-800">Security Note</h3>
            <p className="text-sm text-amber-700 mt-1">
              For production, implement encryption at rest for sensitive values and consider using a secrets manager.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "200px",
        color: "#64748b",
      }}>
        <InlineLoader size="md" className="mr-2" />
        Loading settings...
      </div>
    }>
      <AdminSettingsContent />
    </Suspense>
  );
}
