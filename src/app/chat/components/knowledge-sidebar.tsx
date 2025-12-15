"use client";

import { useMemo, useState, useEffect } from "react";
import { BookOpen, FileText, Globe, Users, Check, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { useChatStore } from "@/stores/chat-store";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/constants";
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

  const selectedSkillCount = useMemo(
    () => Array.from(skillSelections.values()).filter(Boolean).length,
    [skillSelections]
  );

  const selectedDocCount = useMemo(
    () => Array.from(documentSelections.values()).filter(Boolean).length,
    [documentSelections]
  );

  const selectedUrlCount = useMemo(
    () => Array.from(urlSelections.values()).filter(Boolean).length,
    [urlSelections]
  );

  const selectedCustomerCount = useMemo(
    () => Array.from(customerSelections.values()).filter(Boolean).length,
    [customerSelections]
  );

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
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {instructionsExpanded && (
            <CardContent className="py-2 px-4 space-y-3">
              {/* Preset Selector */}
              {!presetsLoading && presets.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Select a preset or write custom instructions
                  </label>
                  <select
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
                value={userInstructions}
                onChange={(e) => handleInstructionsChange(e.target.value)}
                placeholder="Enter instructions for how the AI should behave..."
                className="min-h-[120px] text-sm resize-none"
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

        {/* Skills Section */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Skills
                <span className="text-muted-foreground">
                  ({selectedSkillCount}/{skills.length})
                </span>
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => selectAllSkills(skills.map((s) => s.id))}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={selectNoSkills}
                >
                  None
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4 max-h-48 overflow-y-auto">
            <div className="space-y-1">
              {skills.map((skill) => (
                <SelectableItem
                  key={skill.id}
                  label={skill.title}
                  selected={skillSelections.get(skill.id) || false}
                  onClick={() => toggleSkill(skill.id)}
                />
              ))}
              {skills.length === 0 && (
                <p className="text-sm text-muted-foreground">No skills available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents Section */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
                <span className="text-muted-foreground">
                  ({selectedDocCount}/{documents.length})
                </span>
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => selectAllDocuments(documents.map((d) => d.id))}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={selectNoDocuments}
                >
                  None
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4 max-h-48 overflow-y-auto">
            <div className="space-y-1">
              {documents.map((doc) => (
                <SelectableItem
                  key={doc.id}
                  label={doc.title || doc.filename}
                  selected={documentSelections.get(doc.id) || false}
                  onClick={() => toggleDocument(doc.id)}
                />
              ))}
              {documents.length === 0 && (
                <p className="text-sm text-muted-foreground">No documents available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* URLs Section */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                URLs
                <span className="text-muted-foreground">
                  ({selectedUrlCount}/{urls.length})
                </span>
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => selectAllUrls(urls.map((u) => u.id))}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={selectNoUrls}
                >
                  None
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4 max-h-48 overflow-y-auto">
            <div className="space-y-1">
              {urls.map((url) => (
                <SelectableItem
                  key={url.id}
                  label={url.title || url.url}
                  selected={urlSelections.get(url.id) || false}
                  onClick={() => toggleUrl(url.id)}
                />
              ))}
              {urls.length === 0 && (
                <p className="text-sm text-muted-foreground">No URLs available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customers Section */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customers
                <span className="text-muted-foreground">
                  ({selectedCustomerCount}/{customers.length})
                </span>
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => selectAllCustomers(customers.map((c) => c.id))}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={selectNoCustomers}
                >
                  None
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4 max-h-48 overflow-y-auto">
            <div className="space-y-1">
              {customers.map((customer) => (
                <SelectableItem
                  key={customer.id}
                  label={customer.name}
                  selected={customerSelections.get(customer.id) || false}
                  onClick={() => toggleCustomer(customer.id)}
                />
              ))}
              {customers.length === 0 && (
                <p className="text-sm text-muted-foreground">No customers available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface SelectableItemProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function SelectableItem({ label, selected, onClick }: SelectableItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
        selected
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-foreground"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center",
          selected
            ? "bg-primary border-primary text-primary-foreground"
            : "border-input"
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>
      <span className="truncate">{label}</span>
    </button>
  );
}
