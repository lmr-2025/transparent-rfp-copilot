"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type IntegrationStatus = {
  configured: boolean;
  lastTestedAt?: string;
  error?: string;
};

type BrandingSettings = {
  appName: string;
  tagline: string;
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

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [branding, setBranding] = useState<BrandingSettings>({
    appName: "Transparent Trust",
    tagline: "AI-powered RFP and security questionnaire assistant",
    primaryColor: "#0ea5e9",
  });
  const [savingBranding, setSavingBranding] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/signin");
      return;
    }

    // Check if admin (you may want to enhance this check)
    fetchSettings();
  }, [session, status, router]);

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
      alert("Branding saved! Changes will appear on next page load.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSave = async (integrationKey: string) => {
    setSaving(integrationKey);
    try {
      const config = INTEGRATIONS[integrationKey];
      for (const envVar of config.envVars) {
        const value = formValues[envVar.key];
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
      setEditingIntegration(null);
      setFormValues({});
      fetchSettings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">Loading settings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
          <p className="text-gray-600 mt-1">Configure integrations and application settings</p>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
            <p className="text-sm text-gray-500">Customize how the app appears to users</p>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App Name
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tagline
              </label>
              <input
                type="text"
                value={branding.tagline}
                onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="AI-powered RFP and security questionnaire assistant"
              />
              <p className="text-xs text-gray-400 mt-1">Shown below the app name on the homepage</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Color
              </label>
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
                onClick={handleSaveBranding}
                disabled={savingBranding}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {savingBranding ? "Saving..." : "Save Branding"}
              </button>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {Object.entries(INTEGRATIONS).map(([key, config]) => {
              const integrationStatus = settings?.integrations[key as keyof typeof settings.integrations];
              const isEditing = editingIntegration === key;

              return (
                <div key={key} className="px-6 py-4">
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
                      <p className="text-xs text-amber-600 mt-3">
                        Note: Settings saved here are stored in the database. For production,
                        your security engineer should implement encryption for sensitive values.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Read-only App Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Application Settings</h2>
            <p className="text-sm text-gray-500">These are configured via environment variables</p>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Default AI Model</span>
              <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">
                {settings?.appSettings.defaultModel}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Max File Upload</span>
              <span className="text-gray-900">{settings?.appSettings.maxFileUploadMb} MB</span>
            </div>
            <div className="flex justify-between">
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
            <div className="flex justify-between">
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

        {/* Security Note */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-medium text-amber-800">Security Note</h3>
          <p className="text-sm text-amber-700 mt-1">
            This is a lightweight admin interface. Before deploying to production, your security
            engineer should implement:
          </p>
          <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
            <li>Encryption at rest for sensitive values (API keys, tokens)</li>
            <li>Audit logging for all settings changes</li>
            <li>Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)</li>
            <li>Rate limiting on settings endpoints</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
