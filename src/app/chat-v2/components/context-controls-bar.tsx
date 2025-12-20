"use client";

import { useState, useEffect, useMemo } from "react";
import { User, Users, Building2, MapPin, Star, Filter, X, ChevronDown, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { parseApiData } from "@/lib/apiClient";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/constants";
import type { CustomerProfile } from "@/types/customerProfile";

export type InstructionPreset = {
  id: string;
  name: string;
  content: string;
  description?: string;
  isShared: boolean;
  isDefault: boolean;
  shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
};

type SegmentFilter = {
  region?: string;
  tier?: string;
  industry?: string;
};

interface ContextControlsBarProps {
  // Persona props
  selectedPresetId: string | null;
  onPresetChange: (preset: InstructionPreset | null) => void;
  userInstructions: string;
  onUserInstructionsChange: (instructions: string) => void;
  // Call mode props (optional - only shown in chat context)
  callMode?: boolean;
  onCallModeChange?: (enabled: boolean) => void;
  // Customer props
  customers: CustomerProfile[];
  selectedCustomerId: string | null;
  onCustomerSelect: (customerId: string | null) => void;
  customersLoading?: boolean;
  // Optional left content (e.g., title)
  leftContent?: React.ReactNode;
  // Optional right content (e.g., action buttons)
  rightContent?: React.ReactNode;
}

export function ContextControlsBar({
  selectedPresetId,
  onPresetChange,
  userInstructions,
  onUserInstructionsChange,
  callMode,
  onCallModeChange,
  customers,
  selectedCustomerId,
  onCustomerSelect,
  customersLoading,
  leftContent,
  rightContent,
}: ContextControlsBarProps) {
  // Persona state
  const [presets, setPresets] = useState<InstructionPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);

  // Customer filter state
  const [segmentFilters, setSegmentFilters] = useState<SegmentFilter>({});

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
        setPresetsLoading(false);
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

  // Extract unique segment values from customers
  const segmentOptions = useMemo(() => {
    const regions = new Set<string>();
    const tiers = new Set<string>();
    const industries = new Set<string>();

    customers.forEach((c) => {
      if (c.region) regions.add(c.region);
      if (c.tier) tiers.add(c.tier);
      if (c.industry) industries.add(c.industry);
    });

    return {
      regions: Array.from(regions).sort(),
      tiers: Array.from(tiers).sort(),
      industries: Array.from(industries).sort(),
    };
  }, [customers]);

  const hasActiveFilters = Object.values(segmentFilters).some(Boolean);

  const filteredCustomers = useMemo(() => {
    if (!hasActiveFilters) return customers;

    return customers.filter((c) => {
      if (segmentFilters.region && c.region && c.region !== segmentFilters.region) return false;
      if (segmentFilters.tier && c.tier && c.tier !== segmentFilters.tier) return false;
      if (segmentFilters.industry && c.industry && c.industry !== segmentFilters.industry) return false;
      return true;
    });
  }, [customers, segmentFilters, hasActiveFilters]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const activeFilterCount = Object.values(segmentFilters).filter(Boolean).length;

  const clearFilters = () => setSegmentFilters({});
  const setFilter = (key: keyof SegmentFilter, value: string | undefined) => {
    setSegmentFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  };

  const isLoading = presetsLoading || customersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center gap-6 px-4 py-2 border-b border-border bg-muted/30">
        {leftContent}
        <span className="text-sm text-muted-foreground">Loading...</span>
        {rightContent && <div className="ml-auto flex items-center gap-2">{rightContent}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-muted/30">
      {/* Left content (e.g., title) */}
      {leftContent}

      {/* Assistant Persona Section */}
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Assistant Persona:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[180px] justify-between">
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
                  <DropdownMenuItem key={preset.id} onClick={() => handlePresetSelect(preset)}>
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
                  <DropdownMenuItem key={preset.id} onClick={() => handlePresetSelect(preset)}>
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
      </div>

      {/* Call Mode Toggle - only shown when props are provided */}
      {onCallModeChange && (
        <>
          <Button
            variant={callMode ? "default" : "outline"}
            size="sm"
            onClick={() => onCallModeChange(!callMode)}
            className={`gap-2 ${callMode ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
          >
            <Phone className="h-4 w-4" />
            Call Mode
          </Button>

          {/* Divider */}
          <div className="h-5 w-px bg-border" />
        </>
      )}

      {/* Divider (when no call mode) */}
      {!onCallModeChange && <div className="h-5 w-px bg-border" />}

      {/* Customer Focus Section */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Customer Focus:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[180px] justify-between">
              <span className="truncate">
                {selectedCustomer ? selectedCustomer.name : "Select customer..."}
              </span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[320px] max-h-[400px] overflow-y-auto">
            <DropdownMenuItem onClick={() => onCustomerSelect(null)}>
              <span className="text-muted-foreground">No customer selected</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {filteredCustomers.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No customers match current filters
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <DropdownMenuItem
                  key={customer.id}
                  onClick={() => onCustomerSelect(customer.id)}
                  className="flex flex-col items-start gap-1"
                >
                  <span className="font-medium">{customer.name}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {customer.industry && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {customer.industry}
                      </span>
                    )}
                    {customer.region && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {customer.region}
                      </span>
                    )}
                    {customer.tier && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {customer.tier}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Segment Filters */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px]">
            {segmentOptions.regions.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Region
                </div>
                {segmentOptions.regions.map((region) => (
                  <DropdownMenuCheckboxItem
                    key={region}
                    checked={segmentFilters.region === region}
                    onCheckedChange={() => setFilter("region", region)}
                  >
                    {region}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {segmentOptions.tiers.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  Tier
                </div>
                {segmentOptions.tiers.map((tier) => (
                  <DropdownMenuCheckboxItem
                    key={tier}
                    checked={segmentFilters.tier === tier}
                    onCheckedChange={() => setFilter("tier", tier)}
                  >
                    {tier}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {segmentOptions.industries.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Industry
                </div>
                {segmentOptions.industries.map((industry) => (
                  <DropdownMenuCheckboxItem
                    key={industry}
                    checked={segmentFilters.industry === industry}
                    onCheckedChange={() => setFilter("industry", industry)}
                  >
                    {industry}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}

            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-destructive">
                  <X className="h-4 w-4 mr-2" />
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right content (e.g., action buttons) - pushed to the right */}
      {rightContent && (
        <div className="flex items-center gap-2 ml-auto">
          {rightContent}
        </div>
      )}
    </div>
  );
}
