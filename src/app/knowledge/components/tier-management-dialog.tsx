"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Info, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillTier } from "@/types/skill";

interface TierManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  skillTitle: string;
  currentTier: SkillTier;
  currentTierOverrides?: Record<string, SkillTier>;
  categories?: string[];
  onSave: (tier: SkillTier, tierOverrides?: Record<string, SkillTier>) => Promise<void>;
}

const TIER_INFO = {
  core: {
    label: "Core",
    color: "text-blue-700 bg-blue-100",
    description: "Always loaded. Use for essential, frequently-needed skills.",
  },
  extended: {
    label: "Extended",
    color: "text-green-700 bg-green-100",
    description: "Searched within category if core skills don't answer. Use for important category-specific skills.",
  },
  library: {
    label: "Library",
    color: "text-gray-700 bg-gray-100",
    description: "Searched across all categories as last resort. Use for specialized or rarely-needed skills.",
  },
} as const;

export function TierManagementDialog({
  isOpen,
  onClose,
  skillTitle,
  currentTier,
  currentTierOverrides = {},
  categories = [],
  onSave,
}: TierManagementDialogProps) {
  const [defaultTier, setDefaultTier] = useState<SkillTier>(currentTier);
  const [overrides, setOverrides] = useState<Record<string, SkillTier>>(currentTierOverrides);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Remove overrides that match the default tier (keep it sparse)
      const cleanedOverrides: Record<string, SkillTier> = {};
      for (const [cat, tier] of Object.entries(overrides)) {
        if (tier !== defaultTier) {
          cleanedOverrides[cat] = tier;
        }
      }

      await onSave(defaultTier, Object.keys(cleanedOverrides).length > 0 ? cleanedOverrides : undefined);
      onClose();
    } catch (error) {
      console.error("Failed to save tier settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const setOverrideForCategory = (category: string, tier: SkillTier) => {
    setOverrides((prev) => ({ ...prev, [category]: tier }));
  };

  const removeOverride = (category: string) => {
    setOverrides((prev) => {
      const newOverrides = { ...prev };
      delete newOverrides[category];
      return newOverrides;
    });
  };

  const getEffectiveTier = (category: string): SkillTier => {
    return overrides[category] || defaultTier;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Tier: {skillTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Progressive Loading System</p>
              <p className="text-blue-800">
                Skills are loaded progressively to minimize context window usage. Set a default tier,
                then optionally override for specific categories where this skill is more/less important.
              </p>
            </div>
          </div>

          {/* Default Tier */}
          <div className="space-y-3">
            <div className="text-base font-semibold">Default Tier</div>
            <div className="space-y-2">
              {(Object.entries(TIER_INFO) as [SkillTier, typeof TIER_INFO[SkillTier]][]).map(([tier, info]) => (
                <button
                  key={tier}
                  type="button"
                  className={cn(
                    "w-full flex items-start space-x-3 p-3 rounded-lg border text-left transition-colors",
                    defaultTier === tier
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                  onClick={() => setDefaultTier(tier)}
                >
                  <div className="mt-1">
                    {defaultTier === tier ? (
                      <div className="h-4 w-4 rounded-full bg-blue-600 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{info.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${info.color}`}>
                        {info.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Category Overrides */}
          {categories.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">Category-Specific Overrides</div>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Override the default tier for specific categories. Leave at default if the skill has the same importance across all categories.
              </p>

              <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                {categories.map((category) => {
                  const effectiveTier = getEffectiveTier(category);
                  const hasOverride = category in overrides;

                  return (
                    <div key={category} className="bg-white p-3 rounded border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${TIER_INFO[effectiveTier].color}`}>
                            {TIER_INFO[effectiveTier].label}
                          </span>
                          {hasOverride && (
                            <span className="text-xs text-purple-600 font-medium">Overridden</span>
                          )}
                        </div>
                        {hasOverride && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOverride(category)}
                            className="h-6 px-2 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reset to default
                          </Button>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {(Object.entries(TIER_INFO) as [SkillTier, typeof TIER_INFO[SkillTier]][]).map(([tier, info]) => (
                          <button
                            key={tier}
                            type="button"
                            className={cn(
                              "flex-1 px-3 py-1.5 rounded border text-xs font-medium transition-colors",
                              effectiveTier === tier
                                ? "bg-blue-100 border-blue-500 text-blue-900"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            )}
                            onClick={() => setOverrideForCategory(category, tier)}
                          >
                            {info.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">
              <strong>Summary:</strong> Default tier is <strong>{TIER_INFO[defaultTier].label}</strong>
              {Object.keys(overrides).length > 0 && (
                <span>
                  {" "}with <strong>{Object.keys(overrides).length}</strong> category override
                  {Object.keys(overrides).length > 1 ? "s" : ""}
                </span>
              )}
              .
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
