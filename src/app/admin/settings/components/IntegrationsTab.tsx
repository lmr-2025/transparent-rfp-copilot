"use client";

import { useState } from "react";
import { SettingsResponse } from "./types";
import { INTEGRATIONS } from "./constants";
import SnowflakeExplorer from "./SnowflakeExplorer";

type IntegrationsTabProps = {
  settings: SettingsResponse | null;
  onSave: (key: string, values: Record<string, string>) => Promise<void>;
};

export default function IntegrationsTab({ settings, onSave }: IntegrationsTabProps) {
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
        const integrationStatus = settings?.integrations?.[key as keyof typeof settings.integrations];
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

                {/* Snowflake Schema Explorer - show when configured */}
                {key === "snowflake" && integrationStatus?.configured && (
                  <SnowflakeExplorer />
                )}
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
              {settings?.appSettings?.defaultModel || "Not set"}
            </code>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Max File Upload</span>
            <span className="text-gray-900">{settings?.appSettings?.maxFileUploadMb || 0} MB</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Anthropic API</span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                settings?.integrations?.anthropic?.configured
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {settings?.integrations?.anthropic?.configured ? "Configured" : "Missing"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Google OAuth</span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                settings?.integrations?.google?.configured
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {settings?.integrations?.google?.configured ? "Configured" : "Missing"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
