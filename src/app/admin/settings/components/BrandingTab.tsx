"use client";

import { BrandingSettings } from "./types";

type BrandingTabProps = {
  branding: BrandingSettings;
  setBranding: (b: BrandingSettings) => void;
  onSave: () => void;
  saving: boolean;
};

export default function BrandingTab({
  branding,
  setBranding,
  onSave,
  saving,
}: BrandingTabProps) {
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
