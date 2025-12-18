"use client";

import { useState, useEffect } from "react";
import { User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseApiData } from "@/lib/apiClient";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/constants";

export type InstructionPreset = {
  id: string;
  name: string;
  content: string;
  description?: string;
  isShared: boolean;
  isDefault: boolean;
  shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
};

interface AssistantPersonaSelectorProps {
  selectedPresetId: string | null;
  onPresetChange: (preset: InstructionPreset | null) => void;
  userInstructions: string;
  onUserInstructionsChange: (instructions: string) => void;
}

export function AssistantPersonaSelector({
  selectedPresetId,
  onPresetChange,
  userInstructions,
  onUserInstructionsChange,
}: AssistantPersonaSelectorProps) {
  const [presets, setPresets] = useState<InstructionPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch instruction presets
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const res = await fetch("/api/instruction-presets");
        if (res.ok) {
          const json = await res.json();
          const data = parseApiData<{ presets: InstructionPreset[] }>(json);
          setPresets(data.presets || []);

          // Auto-select default preset if no instructions are set
          const defaultPreset = (data.presets || []).find(p => p.isDefault);
          if (defaultPreset && !userInstructions) {
            onPresetChange(defaultPreset);
            onUserInstructionsChange(defaultPreset.content);
            localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, defaultPreset.content);
          }
        }
      } catch {
        // Silent failure - presets are optional
      } finally {
        setIsLoading(false);
      }
    };
    loadPresets();
  }, []);

  const handlePresetSelect = (preset: InstructionPreset | null) => {
    onPresetChange(preset);
    if (preset) {
      onUserInstructionsChange(preset.content);
      localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, preset.content);
    } else {
      onUserInstructionsChange(DEFAULTS.USER_INSTRUCTIONS);
      localStorage.setItem(STORAGE_KEYS.USER_INSTRUCTIONS, DEFAULTS.USER_INSTRUCTIONS);
    }
  };

  // Group presets by type
  const orgPresets = presets.filter((p) => p.isShared && p.shareStatus === "APPROVED");
  const myPresets = presets.filter((p) => !p.isShared);

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading personas...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
      <User className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground">Assistant Persona:</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-between">
            <span className="truncate">
              {selectedPreset ? selectedPreset.name : "Default Assistant"}
            </span>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuItem onClick={() => handlePresetSelect(null)}>
            <div className="flex flex-col">
              <span>Default Assistant</span>
              <span className="text-xs text-muted-foreground">Standard AI assistant behavior</span>
            </div>
          </DropdownMenuItem>

          {orgPresets.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Organization Personas
              </div>
              {orgPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2">
                      {preset.name}
                      {preset.isDefault && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          default
                        </span>
                      )}
                    </span>
                    {preset.description && (
                      <span className="text-xs text-muted-foreground">{preset.description}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {myPresets.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                My Personas
              </div>
              {myPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                >
                  <div className="flex flex-col">
                    <span>{preset.name}</span>
                    {preset.description && (
                      <span className="text-xs text-muted-foreground">{preset.description}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedPreset?.description && (
        <span className="text-xs text-muted-foreground italic hidden md:inline">
          {selectedPreset.description}
        </span>
      )}
    </div>
  );
}
