"use client";

import {
  User,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Plus,
  MessageSquare,
  FileText,
} from "lucide-react";
import { type InstructionPreset, statusColors, personaFeatures } from "./types";

export function OverviewTab({ presets }: { presets: InstructionPreset[] }) {
  // Stats
  const totalPersonas = presets.length;
  const approvedCount = presets.filter(p => p.shareStatus === "APPROVED" || p.isDefault).length;
  const pendingCount = presets.filter(p => p.shareStatus === "PENDING_APPROVAL").length;
  const privateCount = presets.filter(p => p.shareStatus === "PRIVATE").length;
  const defaultPersona = presets.find(p => p.isDefault);

  const getFeatureIcon = (id: string) => {
    switch (id) {
      case "chat": return MessageSquare;
      case "collateral": return FileText;
      default: return MessageSquare;
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{totalPersonas}</div>
                <div className="text-sm text-slate-500">Total Personas</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{approvedCount}</div>
                <div className="text-sm text-slate-500">Approved</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{pendingCount}</div>
                <div className="text-sm text-slate-500">Pending Review</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <XCircle className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{privateCount}</div>
                <div className="text-sm text-slate-500">Private</div>
              </div>
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Persona list */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">All Personas</h3>
              <span className="text-xs text-slate-400">{totalPersonas} total</span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {presets.length > 0 ? (
                presets.map(preset => {
                  const colors = statusColors[preset.shareStatus];
                  return (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-purple-600 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{preset.name}</span>
                        {preset.isDefault && (
                          <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {preset.shareStatus === "PENDING_APPROVAL" ? "Pending" : preset.shareStatus.toLowerCase()}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-400 italic py-4 text-center">
                  No personas created yet
                </p>
              )}
            </div>
          </div>

          {/* Right: Used in features + Default persona */}
          <div className="space-y-6">
            {/* Default Persona */}
            {defaultPersona && (
              <div className="bg-white rounded-lg border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold text-slate-800">Default Persona</h3>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="font-medium text-slate-700">{defaultPersona.name}</div>
                  {defaultPersona.description && (
                    <div className="text-sm text-slate-500 mt-1">{defaultPersona.description}</div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Used when no specific persona is selected
                </p>
              </div>
            )}

            {/* Features that use personas */}
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Used In</h3>
              <div className="space-y-2">
                {personaFeatures.map(feature => {
                  const Icon = getFeatureIcon(feature.id);
                  return (
                    <div
                      key={feature.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50"
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      <div>
                        <div className="text-sm font-medium text-slate-700">{feature.name}</div>
                        <div className="text-xs text-slate-400">{feature.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">Create a new persona</div>
              <div className="text-sm text-slate-500">Use AI to help write instructions</div>
            </div>
            <button
              onClick={() => {
                const event = new CustomEvent('navigate-tab', { detail: 'builder' });
                window.dispatchEvent(event);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>
          <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">Manage personas</div>
              <div className="text-sm text-slate-500">Edit, share, or set default</div>
            </div>
            <button
              onClick={() => {
                const event = new CustomEvent('navigate-tab', { detail: 'personas' });
                window.dispatchEvent(event);
              }}
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
