"use client";

import { useState, useMemo } from "react";
import { Users, Building2, MapPin, Star, Filter, X, ChevronDown } from "lucide-react";
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
import type { CustomerProfile } from "@/types/customerProfile";

interface CustomerFocusBarProps {
  customers: CustomerProfile[];
  selectedCustomerId: string | null;
  onCustomerSelect: (customerId: string | null) => void;
  isLoading?: boolean;
}

type SegmentFilter = {
  region?: string;
  tier?: string;
  industry?: string;
};

export function CustomerFocusBar({
  customers,
  selectedCustomerId,
  onCustomerSelect,
  isLoading,
}: CustomerFocusBarProps) {
  const [segmentFilters, setSegmentFilters] = useState<SegmentFilter>({});

  // Extract unique segment values from customers (from Salesforce static fields)
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

  // Filter customers based on segment filters
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (segmentFilters.region && c.region !== segmentFilters.region) return false;
      if (segmentFilters.tier && c.tier !== segmentFilters.tier) return false;
      if (segmentFilters.industry && c.industry !== segmentFilters.industry) return false;
      return true;
    });
  }, [customers, segmentFilters]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const activeFilterCount = Object.values(segmentFilters).filter(Boolean).length;

  const clearFilters = () => {
    setSegmentFilters({});
  };

  const setFilter = (key: keyof SegmentFilter, value: string | undefined) => {
    setSegmentFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading customers...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground">Customer Focus:</span>

      {/* Customer Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-between">
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

      {/* Segment Filters */}
      <div className="flex items-center gap-2 ml-auto">
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
            {/* Region Filter */}
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

            {/* Tier Filter */}
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

            {/* Industry Filter */}
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

      {/* Selected Customer Summary */}
      {selectedCustomer && (
        <div className="hidden lg:flex items-center gap-2 ml-2 pl-2 border-l border-border">
          {selectedCustomer.industry && (
            <Badge variant="outline" className="gap-1">
              <Building2 className="h-3 w-3" />
              {selectedCustomer.industry}
            </Badge>
          )}
          {selectedCustomer.region && (
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" />
              {selectedCustomer.region}
            </Badge>
          )}
          {selectedCustomer.tier && (
            <Badge variant="outline" className="gap-1">
              <Star className="h-3 w-3" />
              {selectedCustomer.tier}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
