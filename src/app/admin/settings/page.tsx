"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, FolderOpen, GripVertical } from "lucide-react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  FileText,
  Users,
  FolderKanban,
  Globe,
  FileCheck,
  RefreshCw,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import { SkillCategoryItem } from "@/types/skill";
import {
  loadCategoriesFromApi,
  addCategory,
  updateCategory,
  deleteCategory,
  saveCategories,
} from "@/lib/categoryStorage";

// ============ TYPES ============

type IntegrationStatus = {
  configured: boolean;
  lastTestedAt?: string;
  error?: string;
};

type BrandingSettings = {
  appName: string;
  tagline: string;
  sidebarSubtitle: string;
  primaryColor: string;
};

type SettingsResponse = {
  integrations: {
    salesforce: IntegrationStatus;
    slack: IntegrationStatus;
    anthropic: IntegrationStatus;
    google: IntegrationStatus;
  };
  appSettings: {
    maxFileUploadMb: number;
    defaultModel: string;
  };
  branding?: BrandingSettings;
};

type IntegrationConfig = {
  name: string;
  description: string;
  envVars: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
  docsUrl?: string;
};

type UsageSummary = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  callCount: number;
};

type FeatureUsage = {
  feature: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  callCount: number;
};

type DailyUsage = {
  date: string;
  tokens: number;
  cost: number;
  calls: number;
};

type RecentCall = {
  id: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: string;
  userEmail?: string;
};

type UsageData = {
  summary: UsageSummary;
  byFeature: FeatureUsage[];
  daily: DailyUsage[];
  recentCalls: RecentCall[];
};

type AuditEntityType =
  | "SKILL"
  | "CUSTOMER"
  | "PROJECT"
  | "DOCUMENT"
  | "REFERENCE_URL"
  | "CONTRACT"
  | "USER"
  | "SETTING"
  | "PROMPT";

type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "VIEWED"
  | "EXPORTED"
  | "OWNER_ADDED"
  | "OWNER_REMOVED"
  | "STATUS_CHANGED"
  | "REFRESHED"
  | "MERGED";

type AuditLogEntry = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityTitle: string | null;
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ============ CONSTANTS ============

const INTEGRATIONS: Record<string, IntegrationConfig> = {
  salesforce: {
    name: "Salesforce",
    description: "Pull customer data from Salesforce to enrich profiles",
    envVars: [
      { key: "SALESFORCE_CLIENT_ID", label: "Client ID", placeholder: "3MVG9..." },
      { key: "SALESFORCE_CLIENT_SECRET", label: "Client Secret", placeholder: "ABC123...", isSecret: true },
      { key: "SALESFORCE_REFRESH_TOKEN", label: "Refresh Token", placeholder: "5Aep861...", isSecret: true },
      { key: "SALESFORCE_INSTANCE_URL", label: "Instance URL", placeholder: "https://yourcompany.salesforce.com" },
    ],
    docsUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm",
  },
  slack: {
    name: "Slack",
    description: "Send notifications to Slack channels",
    envVars: [
      { key: "SLACK_WEBHOOK_URL", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", isSecret: true },
    ],
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
};

const FEATURE_LABELS: Record<string, string> = {
  questions: "Quick Questions",
  chat: "The Oracle (Chat)",
  "skills-suggest": "Knowledge Gremlin (Skills)",
  "customers-suggest": "The Rolodex (Customers)",
  "contracts-analyze": "Clause Checker (Contracts)",
  projects: "Project Answerer",
};

const entityTypeConfig: Record<
  AuditEntityType,
  { label: string; icon: typeof FileText; color: string }
> = {
  SKILL: { label: "Skill", icon: FileText, color: "#0ea5e9" },
  CUSTOMER: { label: "Customer", icon: Users, color: "#8b5cf6" },
  PROJECT: { label: "Project", icon: FolderKanban, color: "#f97316" },
  DOCUMENT: { label: "Document", icon: FileText, color: "#10b981" },
  REFERENCE_URL: { label: "URL", icon: Globe, color: "#6366f1" },
  CONTRACT: { label: "Contract", icon: FileCheck, color: "#ec4899" },
  USER: { label: "User", icon: User, color: "#64748b" },
  SETTING: { label: "Setting", icon: FileText, color: "#94a3b8" },
  PROMPT: { label: "Prompt", icon: FileText, color: "#f59e0b" },
};

const actionConfig: Record<AuditAction, { label: string; color: string }> = {
  CREATED: { label: "Created", color: "#10b981" },
  UPDATED: { label: "Updated", color: "#0ea5e9" },
  DELETED: { label: "Deleted", color: "#ef4444" },
  VIEWED: { label: "Viewed", color: "#64748b" },
  EXPORTED: { label: "Exported", color: "#8b5cf6" },
  OWNER_ADDED: { label: "Owner Added", color: "#10b981" },
  OWNER_REMOVED: { label: "Owner Removed", color: "#f97316" },
  STATUS_CHANGED: { label: "Status Changed", color: "#0ea5e9" },
  REFRESHED: { label: "Refreshed", color: "#6366f1" },
  MERGED: { label: "Merged", color: "#ec4899" },
};

const TABS = [
  { id: "branding", label: "Branding" },
  { id: "integrations", label: "Integrations" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "categories", label: "Categories" },
  { id: "usage", label: "API Usage" },
  { id: "audit", label: "Audit Log" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ============ HELPER FUNCTIONS ============

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty)";
    if (value.length <= 3) return value.map(v => formatValue(v)).join(", ");
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value).slice(0, 100) + "...";
  }
  const str = String(value);
  return str.length > 100 ? str.slice(0, 100) + "..." : str;
}

// ============ TAB COMPONENTS ============

function BrandingTab({
  branding,
  setBranding,
  onSave,
  saving,
}: {
  branding: BrandingSettings;
  setBranding: (b: BrandingSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">App Name</label>
        <input
          type="text"
          value={branding.appName}
          onChange={(e) => setBranding({ ...branding, appName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Transparent Trust"
        />
        <p className="text-xs text-gray-400 mt-1">Displayed in the sidebar and homepage</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
        <input
          type="text"
          value={branding.tagline}
          onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Turn your knowledge into trustworthy answers..."
        />
        <p className="text-xs text-gray-400 mt-1">Shown below the app name on the homepage</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sidebar Subtitle</label>
        <input
          type="text"
          value={branding.sidebarSubtitle}
          onChange={(e) => setBranding({ ...branding, sidebarSubtitle: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Transparent LLM Assistant"
        />
        <p className="text-xs text-gray-400 mt-1">Shown below the app name in the sidebar</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={branding.primaryColor}
            onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border border-gray-300"
          />
          <input
            type="text"
            value={branding.primaryColor}
            onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
            className="w-28 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            placeholder="#0ea5e9"
          />
          <div
            className="px-3 py-1.5 rounded text-white text-sm font-medium"
            style={{ backgroundColor: branding.primaryColor }}
          >
            Preview
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">Used for buttons and accents</p>
      </div>
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Branding"}
        </button>
      </div>
    </div>
  );
}

function IntegrationsTab({
  settings,
  onSave,
}: {
  settings: SettingsResponse | null;
  onSave: (key: string, values: Record<string, string>) => Promise<void>;
}) {
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (integrationKey: string) => {
    setSaving(integrationKey);
    await onSave(integrationKey, formValues);
    setSaving(null);
    setEditingIntegration(null);
    setFormValues({});
  };

  return (
    <div className="divide-y divide-gray-200">
      {Object.entries(INTEGRATIONS).map(([key, config]) => {
        const integrationStatus = settings?.integrations[key as keyof typeof settings.integrations];
        const isEditing = editingIntegration === key;

        return (
          <div key={key} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-gray-900">{config.name}</h3>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      integrationStatus?.configured
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {integrationStatus?.configured ? "Configured" : "Not configured"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{config.description}</p>
              </div>
              <button
                onClick={() => {
                  setEditingIntegration(isEditing ? null : key);
                  setFormValues({});
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {isEditing ? "Cancel" : "Configure"}
              </button>
            </div>

            {isEditing && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <div className="space-y-4">
                  {config.envVars.map((envVar) => (
                    <div key={envVar.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {envVar.label}
                      </label>
                      <input
                        type={envVar.isSecret ? "password" : "text"}
                        placeholder={envVar.placeholder}
                        value={formValues[envVar.key] || ""}
                        onChange={(e) =>
                          setFormValues({ ...formValues, [envVar.key]: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">{envVar.key}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  {config.docsUrl && (
                    <a
                      href={config.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View documentation
                    </a>
                  )}
                  <button
                    onClick={() => handleSave(key)}
                    disabled={saving === key}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving === key ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Read-only App Settings */}
      <div className="py-4">
        <h3 className="font-medium text-gray-900 mb-3">Application Settings</h3>
        <p className="text-sm text-gray-500 mb-4">These are configured via environment variables</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Default AI Model</span>
            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
              {settings?.appSettings.defaultModel}
            </code>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Max File Upload</span>
            <span className="text-gray-900">{settings?.appSettings.maxFileUploadMb} MB</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Anthropic API</span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                settings?.integrations.anthropic.configured
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {settings?.integrations.anthropic.configured ? "Configured" : "Missing"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Google OAuth</span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                settings?.integrations.google.configured
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {settings?.integrations.google.configured ? "Configured" : "Missing"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type RateLimitSettingItem = {
  key: string;
  value: string;
  description: string;
  isDefault: boolean;
};

function RateLimitsTab() {
  const [settings, setSettings] = useState<RateLimitSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/app-settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data.settings || []);
        const values: Record<string, string> = {};
        (data.settings || []).forEach((s: RateLimitSettingItem) => {
          values[s.key] = s.value;
        });
        setEditValues(values);
      })
      .catch(() => toast.error("Failed to load rate limit settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const res = await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      // Update local state to reflect saved value
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value: editValues[key], isDefault: false } : s))
      );
      toast.success(`${key} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save setting");
    } finally {
      setSaving(null);
    }
  };

  const getInputType = (key: string) => {
    if (key === "LLM_PROVIDER") return "select";
    return "number";
  };

  const formatLabel = (key: string) => {
    const labels: Record<string, string> = {
      LLM_BATCH_SIZE: "Batch Size",
      LLM_BATCH_DELAY_MS: "Delay Between Batches (ms)",
      LLM_RATE_LIMIT_RETRY_WAIT_MS: "Rate Limit Retry Wait (ms)",
      LLM_RATE_LIMIT_MAX_RETRIES: "Max Retries on Rate Limit",
      LLM_PROVIDER: "LLM Provider",
    };
    return labels[key] || key;
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Loader2 size={24} className="animate-spin mx-auto mb-2" />
        Loading rate limit settings...
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Configure rate limit settings for batch question generation. These settings help manage API rate limits
        and can be adjusted based on your Anthropic tier or AWS Bedrock deployment.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-blue-800 mb-2">Rate Limit Tiers</h4>
        <p className="text-sm text-blue-700 mb-2">
          Anthropic API rate limits vary by tier. Adjust these settings based on your organization&apos;s limits:
        </p>
        <ul className="text-sm text-blue-700 list-disc ml-4 space-y-1">
          <li><strong>Free tier:</strong> 20,000 tokens/minute — use batch size 3, delay 30s</li>
          <li><strong>Build tier:</strong> 40,000 tokens/minute — use batch size 5, delay 15s</li>
          <li><strong>Scale tier:</strong> 80,000+ tokens/minute — use batch size 10, delay 5s</li>
          <li><strong>AWS Bedrock:</strong> Higher limits — use batch size 15, delay 2s</li>
        </ul>
      </div>

      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.key} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formatLabel(setting.key)}
                  {setting.isDefault && (
                    <span className="ml-2 text-xs text-gray-400">(default)</span>
                  )}
                </label>
                <p className="text-xs text-gray-500 mb-2">{setting.description}</p>

                {getInputType(setting.key) === "select" ? (
                  <select
                    value={editValues[setting.key] || ""}
                    onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="anthropic">Anthropic (Direct API)</option>
                    <option value="bedrock">AWS Bedrock</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={editValues[setting.key] || ""}
                    onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                )}
              </div>

              <button
                onClick={() => handleSave(setting.key)}
                disabled={saving === setting.key || editValues[setting.key] === setting.value}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === setting.key ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h4 className="font-medium text-amber-800 mb-1">Note</h4>
        <p className="text-sm text-amber-700">
          Changes take effect immediately for new batch operations. No restart required.
        </p>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<SkillCategoryItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load categories from API on mount
  useEffect(() => {
    loadCategoriesFromApi()
      .then(setCategories)
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  const handleAdd = async () => {
    setError(null);
    if (!newName.trim()) {
      setError("Category name is required");
      return;
    }
    if (categories.some((cat) => cat.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError("A category with this name already exists");
      return;
    }
    setIsSaving(true);
    try {
      const added = await addCategory(newName, newDescription);
      setCategories([...categories, added]);
      setNewName("");
      setNewDescription("");
      setShowForm(false);
      toast.success("Category created");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create category";
      toast.error(message);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setError(null);
    if (!newName.trim()) {
      setError("Category name is required");
      return;
    }
    if (categories.some((cat) => cat.id !== id && cat.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError("A category with this name already exists");
      return;
    }
    setIsSaving(true);
    try {
      await updateCategory(id, { name: newName.trim(), description: newDescription.trim() || undefined });
      setCategories(categories.map((cat) =>
        cat.id === id ? { ...cat, name: newName.trim(), description: newDescription.trim() || undefined } : cat
      ));
      setEditingId(null);
      setNewName("");
      setNewDescription("");
      toast.success("Category updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update category";
      toast.error(message);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCategory(id);
      setCategories(categories.filter((cat) => cat.id !== id));
      toast.success("Category deleted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete category";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (cat: SkillCategoryItem) => {
    setEditingId(cat.id);
    setNewName(cat.name);
    setNewDescription(cat.description || "");
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewName("");
    setNewDescription("");
    setError(null);
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;
    const newCategories = [...categories];
    [newCategories[index], newCategories[newIndex]] = [newCategories[newIndex], newCategories[index]];
    setCategories(newCategories);
    saveCategories(newCategories);
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Organize your skills into broad capability areas. Skills can belong to multiple categories.
      </p>

      {!showForm && !editingId && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-md text-sm font-medium hover:bg-indigo-600 mb-4"
        >
          <Plus size={16} />
          Add Category
        </button>
      )}

      {showForm && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
          <h4 className="font-medium mb-3">Add Category</h4>
          {error && (
            <div className="p-2 bg-red-50 text-red-600 rounded text-sm mb-3">{error}</div>
          )}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Security & Compliance"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Brief description (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-indigo-500 text-white rounded-md text-sm font-medium hover:bg-indigo-600"
            >
              Add Category
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); setNewName(""); setNewDescription(""); }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoadingCategories ? (
        <div className="p-8 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">Loading categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <FolderOpen size={40} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">No categories yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className={`p-3 rounded-lg border flex items-center gap-3 ${
                editingId === cat.id ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200"
              }`}
            >
              <button
                onClick={() => moveCategory(index, "up")}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                <GripVertical size={14} />
              </button>

              {editingId === cat.id ? (
                <div className="flex-1">
                  {error && <div className="p-2 bg-red-50 text-red-600 rounded text-sm mb-2">{error}</div>}
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1"
                  />
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(cat.id)} className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
                      Save
                    </button>
                    <button onClick={cancelEdit} className="px-3 py-1 bg-white border border-gray-300 text-gray-600 rounded text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={14} className="text-indigo-500" />
                      <span className="font-medium text-sm">{cat.name}</span>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-gray-500 ml-5 mt-0.5">{cat.description}</p>
                    )}
                  </div>
                  <button onClick={() => startEdit(cat)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsageTab() {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<"user" | "all">("all");

  const fetchUsageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage?days=${days}&scope=${scope}`);
      if (!res.ok) throw new Error("Failed to fetch usage data");
      const data = await res.json();
      setUsageData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days, scope]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  const maxTokens = usageData?.byFeature.reduce((max, f) => Math.max(max, f.totalTokens), 0) || 1;
  const maxDailyTokens = usageData?.daily.reduce((max, d) => Math.max(max, d.tokens), 0) || 1;

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading usage data...</div>;
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex gap-3 mb-4">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "user" | "all")}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All Users</option>
          <option value="user">My Usage Only</option>
        </select>
        <button
          onClick={fetchUsageData}
          className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {usageData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Total Tokens</div>
              <div className="text-xl font-bold">{formatTokens(usageData.summary.totalTokens)}</div>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Estimated Cost</div>
              <div className="text-xl font-bold text-green-600">{formatCost(usageData.summary.totalCost)}</div>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">API Calls</div>
              <div className="text-xl font-bold">{usageData.summary.callCount.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Avg Cost/Call</div>
              <div className="text-xl font-bold">
                {formatCost(usageData.summary.totalCost / Math.max(usageData.summary.callCount, 1))}
              </div>
            </div>
          </div>

          {/* Usage by Feature */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg mb-4">
            <h4 className="font-medium mb-3">Usage by Feature</h4>
            {usageData.byFeature.length === 0 ? (
              <p className="text-gray-400 text-sm">No usage data yet</p>
            ) : (
              <div className="space-y-3">
                {usageData.byFeature.map((item) => (
                  <div key={item.feature}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{FEATURE_LABELS[item.feature] || item.feature}</span>
                      <span className="text-gray-500">
                        {formatTokens(item.totalTokens)} ({formatCost(item.totalCost)})
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        style={{ width: `${(item.totalTokens / maxTokens) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily Chart */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <h4 className="font-medium mb-3">Daily Usage</h4>
            {usageData.daily.length === 0 ? (
              <p className="text-gray-400 text-sm">No usage data yet</p>
            ) : (
              <>
                <div className="flex items-end gap-px h-24">
                  {usageData.daily.slice(-30).map((day) => (
                    <div
                      key={day.date}
                      className="flex-1 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t"
                      style={{ height: `${(day.tokens / maxDailyTokens) * 100}%`, minHeight: day.tokens > 0 ? "4px" : "0px" }}
                      title={`${day.date}: ${formatTokens(day.tokens)} tokens`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>{usageData.daily[0]?.date}</span>
                  <span>{usageData.daily[usageData.daily.length - 1]?.date}</span>
                </div>
              </>
            )}
          </div>

          {/* Recent API Calls */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3">Recent API Calls</h4>
            {usageData.recentCalls.length === 0 ? (
              <p className="text-gray-400 text-sm">No recent calls</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Time</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">Feature</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Input</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Output</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Total</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.recentCalls.map((call) => (
                      <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          {FEATURE_LABELS[call.feature] || call.feature}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-gray-600">
                          {formatTokens(call.inputTokens)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-gray-600">
                          {formatTokens(call.outputTokens)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {formatTokens(call.totalTokens)}
                        </td>
                        <td className="py-2 px-2 text-right text-green-600 font-medium">
                          {formatCost(call.estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AuditTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState<AuditEntityType | "">("");
  const [selectedAction, setSelectedAction] = useState<AuditAction | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchAuditLog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      if (searchQuery) params.set("search", searchQuery);
      if (selectedEntityType) params.set("entityType", selectedEntityType);
      if (selectedAction) params.set("action", selectedAction);

      const response = await fetch(`/api/audit-log?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch audit log");
      const data = await response.json();
      setEntries(data.entries);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, selectedEntityType, selectedAction]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedEntityType("");
    setSelectedAction("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchQuery || selectedEntityType || selectedAction;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Track all changes across skills, customers, projects, and more</p>

      {/* Search and Filters */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-1.5">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="flex-1 border-none outline-none text-sm bg-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${
              showFilters ? "bg-blue-500 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            <Filter size={14} />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <button
            onClick={fetchAuditLog}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-gray-200 flex-wrap">
            <select
              value={selectedEntityType}
              onChange={(e) => { setSelectedEntityType(e.target.value as AuditEntityType | ""); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm"
            >
              <option value="">All Types</option>
              {Object.entries(entityTypeConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value as AuditAction | ""); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm"
            >
              <option value="">All Actions</option>
              {Object.entries(actionConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700">
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && entries.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
          Loading audit log...
        </div>
      )}

      {/* Empty */}
      {!isLoading && entries.length === 0 && !error && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Clock size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">No audit log entries yet</p>
        </div>
      )}

      {/* Entries */}
      {entries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {entries.map((entry, index) => {
            const entityConfig = entityTypeConfig[entry.entityType];
            const actConfig = actionConfig[entry.action];
            const isExpanded = expandedIds.has(entry.id);
            const EntityIcon = entityConfig.icon;

            return (
              <div key={entry.id} className={index < entries.length - 1 ? "border-b border-gray-100" : ""}>
                <button
                  onClick={() => toggleExpanded(entry.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left ${isExpanded ? "bg-gray-50" : ""}`}
                >
                  {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${entityConfig.color}15` }}
                  >
                    <EntityIcon size={16} style={{ color: entityConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${actConfig.color}15`, color: actConfig.color }}
                      >
                        {actConfig.label}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {entityConfig.label}
                      </span>
                    </div>
                    <div className="font-medium text-sm text-gray-900 truncate mt-1">
                      {entry.entityTitle || entry.entityId}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm text-gray-600">{entry.userName || entry.userEmail || "System"}</div>
                    <div className="text-xs text-gray-400" title={formatFullDate(entry.createdAt)}>
                      {formatDate(entry.createdAt)}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pl-12 bg-gray-50">
                    <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <Clock size={12} />
                      {formatFullDate(entry.createdAt)}
                    </div>
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div className="mb-2">
                        <h5 className="text-xs font-medium text-gray-600 mb-1">Changes</h5>
                        <div className="bg-white border border-gray-200 rounded text-xs">
                          {Object.entries(entry.changes).map(([field, change], i) => (
                            <div
                              key={field}
                              className={`grid grid-cols-3 gap-2 p-2 ${i < Object.keys(entry.changes!).length - 1 ? "border-b border-gray-100" : ""}`}
                            >
                              <div className="font-medium text-gray-600">{field}</div>
                              <div className="text-red-500">From: {formatValue(change.from)}</div>
                              <div className="text-green-500">To: {formatValue(change.to)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-400">ID: {entry.entityId}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 p-3 bg-white border border-gray-200 rounded-lg">
          <span className="text-sm text-gray-500">
            {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ MAIN COMPONENT ============

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

  // Get tab from URL or default to "branding"
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

  // Update URL when tab changes
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
      const data = await res.json();
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
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
        <Loader2 className="animate-spin" style={{ marginRight: "8px" }} />
        Loading settings...
      </div>
    }>
      <AdminSettingsContent />
    </Suspense>
  );
}
