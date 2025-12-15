"use client";

import { useState, useEffect } from "react";
import { BookOpen, FileText, Globe, Users, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useSelectionStore } from "@/stores/selection-store";
import { useChatStore } from "@/stores/chat-store";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/constants";
import { KnowledgeSourceList } from "./knowledge-source-list";
import type { Skill } from "@/types/skill";
import type { ReferenceUrl } from "@/types/referenceUrl";
import type { CustomerProfile } from "@/types/customerProfile";

type InstructionPreset = {
  id: string;
  name: string;
  content: string;
  description?: string;
  isShared: boolean;
  isDefault: boolean;
  shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
};

interface KnowledgeSidebarProps {
  skills: Skill[];
  documents: { id: string; title: string; filename: string }[];
  urls: ReferenceUrl[];
  customers: CustomerProfile[];
  isLoading?: boolean;
}

export function KnowledgeSidebar({
  skills,
  documents,
  urls,
  customers,
  isLoading,
}: KnowledgeSidebarProps) {
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [presets, setPresets] = useState<InstructionPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetsLoading, setPresetsLoading] = useState(true);

  const { userInstructions, setUserInstructions } = useChatStore();

  // Fetch instruction presets
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const res = await fetch("/api/instruction-presets");
        if (res.ok) {
          const data = await res.json();
          setPresets(data.presets || []);
          // Auto-select default preset if no instructions are set
          const defaultPreset = (data.presets || []).find((p: InstructionPreset) => p.isDefault);
          if (defaultPreset && !userInstructions) {
            setSelectedPresetId(defaultPreset.id);
            setUserInstructions(defaultPreset.content);
            localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, defaultPreset.content);
          }
        }
      } catch (err) {
        console.error("Failed to load presets:", err);
      } finally {
        setPresetsLoading(false);
      }
    };
    loadPresets();
  }, []);

  const {
    skillSelections,
    documentSelections,
    urlSelections,
    customerSelections,
    toggleSkill,
    toggleDocument,
    toggleUrl,
    toggleCustomer,
    selectAllSkills,
    selectNoSkills,
    selectAllDocuments,
    selectNoDocuments,
    selectAllUrls,
    selectNoUrls,
    selectAllCustomers,
    selectNoCustomers,
  } = useSelectionStore();

  const handleInstructionsChange = (value: string) => {
    setUserInstructions(value);
    localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, value);
    // Clear preset selection when manually editing
    setSelectedPresetId(null);
  };

  const handlePresetChange = (presetId: string) => {
    if (presetId === "custom") {
      setSelectedPresetId(null);
      return;
    }
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setSelectedPresetId(preset.id);
      setUserInstructions(preset.content);
      localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, preset.content);
    }
  };

  const handleResetInstructions = () => {
    setUserInstructions(DEFAULTS.USER_INSTRUCTIONS);
    localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, DEFAULTS.USER_INSTRUCTIONS);
    setSelectedPresetId(null);
  };

  // Group presets by type
  const orgPresets = presets.filter((p) => p.isShared && p.shareStatus === "APPROVED");
  const myPresets = presets.filter((p) => !p.isShared);

  if (isLoading) {
    return (
      <div className="w-80 border-l border-border p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-border overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Instructions Section */}
        <Card>
          <CardHeader className="py-3 px-4">
            <button
              onClick={() => setInstructionsExpanded(!instructionsExpanded)}
              className="w-full flex items-center justify-between"
              aria-expanded={instructionsExpanded}
              aria-controls="instructions-content"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Instructions
                {selectedPresetId && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (preset)
                  </span>
                )}
              </CardTitle>
              {instructionsExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
          </CardHeader>
          {instructionsExpanded && (
            <CardContent id="instructions-content" className="py-2 px-4 space-y-3">
              {/* Preset Selector */}
              {!presetsLoading && presets.length > 0 && (
                <div className="space-y-1">
                  <label htmlFor="instruction-preset-select" className="text-xs text-muted-foreground">
                    Select a preset or write custom instructions
                  </label>
                  <select
                    id="instruction-preset-select"
                    value={selectedPresetId || "custom"}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-input rounded-md bg-background"
                  >
                    <option value="custom">Custom Instructions</option>
                    {orgPresets.length > 0 && (
                      <optgroup label="Org Presets">
                        {orgPresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name} {preset.isDefault ? "(default)" : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {myPresets.length > 0 && (
                      <optgroup label="My Presets">
                        {myPresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* Selected preset description */}
              {selectedPresetId && (() => {
                const preset = presets.find((p) => p.id === selectedPresetId);
                return preset?.description ? (
                  <p className="text-xs text-muted-foreground italic">
                    {preset.description}
                  </p>
                ) : null;
              })()}

              <Textarea
                id="user-instructions-textarea"
                value={userInstructions}
                onChange={(e) => handleInstructionsChange(e.target.value)}
                placeholder="Enter instructions for how the AI should behave..."
                className="min-h-[120px] text-sm resize-none"
                aria-label="User instructions for AI behavior"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {userInstructions.length.toLocaleString()} characters
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleResetInstructions}
                >
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Knowledge Sources
        </h2>

        {/* Skills */}
        <KnowledgeSourceList
          title="Skills"
          icon={<BookOpen className="h-4 w-4" />}
          items={skills.map((s) => ({ id: s.id, label: s.title }))}
          selections={skillSelections}
          onToggle={toggleSkill}
          onSelectAll={selectAllSkills}
          onSelectNone={selectNoSkills}
          emptyMessage="No skills available"
        />

        {/* Documents */}
        <KnowledgeSourceList
          title="Documents"
          icon={<FileText className="h-4 w-4" />}
          items={documents.map((d) => ({ id: d.id, label: d.title || d.filename }))}
          selections={documentSelections}
          onToggle={toggleDocument}
          onSelectAll={selectAllDocuments}
          onSelectNone={selectNoDocuments}
          emptyMessage="No documents available"
        />

        {/* URLs */}
        <KnowledgeSourceList
          title="URLs"
          icon={<Globe className="h-4 w-4" />}
          items={urls.map((u) => ({ id: u.id, label: u.title || u.url }))}
          selections={urlSelections}
          onToggle={toggleUrl}
          onSelectAll={selectAllUrls}
          onSelectNone={selectNoUrls}
          emptyMessage="No URLs available"
        />

        {/* Customers */}
        <KnowledgeSourceList
          title="Customers"
          icon={<Users className="h-4 w-4" />}
          items={customers.map((c) => ({ id: c.id, label: c.name }))}
          selections={customerSelections}
          onToggle={toggleCustomer}
          onSelectAll={selectAllCustomers}
          onSelectNone={selectNoCustomers}
          emptyMessage="No customers available"
        />
      </div>
    </div>
  );
}
