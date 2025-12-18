"use client";

import { useState, useEffect } from "react";
import {
  Presentation,
  ExternalLink,
  Loader2,
  Search,
  RefreshCw,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import type { TemplateFillContext } from "@/types/template";

type DrivePresentation = {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
};

type PlaceholderReplacement = {
  placeholder: string;
  value: string;
};

type FillResponse = {
  presentationId: string;
  webViewLink: string;
  replacementCount: number;
  copied: boolean;
};

interface GoogleSlidesPickerProps {
  context: TemplateFillContext;
  disabled?: boolean;
}

export function GoogleSlidesPicker({ context, disabled }: GoogleSlidesPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPresentation, setSelectedPresentation] = useState<DrivePresentation | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [showPlaceholderEditor, setShowPlaceholderEditor] = useState(false);

  // Fetch presentations
  const {
    data: presentations,
    isLoading: presentationsLoading,
    error: presentationsError,
    refetch: refetchPresentations,
  } = useApiQuery<DrivePresentation[]>({
    queryKey: ["google-slides", searchQuery],
    url: "/api/google/slides",
    params: { q: searchQuery || undefined, limit: 15 },
    responseKey: "presentations",
    transform: (data) => (Array.isArray(data) ? data : []),
    retry: false,
  });

  // Fetch placeholders when presentation is selected
  const { data: placeholdersData, isLoading: placeholdersLoading } = useApiQuery<string[]>({
    queryKey: ["google-slides-placeholders", selectedPresentation?.id],
    url: "/api/google/slides",
    params: {
      presentationId: selectedPresentation?.id,
      placeholders: true,
    },
    responseKey: "placeholders",
    transform: (data) => (Array.isArray(data) ? data : []),
    enabled: !!selectedPresentation,
  });

  // Handle placeholders data when it changes
  useEffect(() => {
    if (placeholdersData) {
      setPlaceholders(placeholdersData);
      // Pre-fill replacements from context
      const prefilled: Record<string, string> = {};
      for (const placeholder of placeholdersData) {
        const value = getContextValue(placeholder, context);
        if (value) {
          prefilled[placeholder] = value;
        }
      }
      setReplacements(prefilled);
      if (placeholdersData.length > 0) {
        setShowPlaceholderEditor(true);
      }
    }
  }, [placeholdersData, context]);

  // Fill mutation
  const fillMutation = useApiMutation<
    FillResponse,
    { presentationId: string; replacements: PlaceholderReplacement[]; copyFirst: boolean; copyTitle: string }
  >({
    url: "/api/google/slides/fill",
    method: "POST",
    responseKey: "data",
    onSuccess: (data) => {
      toast.success("Presentation filled successfully!");
      // Open in new tab
      if (data.webViewLink) {
        window.open(data.webViewLink, "_blank");
      }
      // Reset state
      setSelectedPresentation(null);
      setPlaceholders([]);
      setReplacements({});
      setShowPlaceholderEditor(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFill = () => {
    if (!selectedPresentation) {
      toast.error("No presentation selected");
      return;
    }

    const replacementArray: PlaceholderReplacement[] = Object.entries(replacements)
      .filter(([, value]) => value.trim())
      .map(([placeholder, value]) => ({ placeholder, value }));

    if (replacementArray.length === 0) {
      toast.error("No replacements to fill");
      return;
    }

    fillMutation.mutate({
      presentationId: selectedPresentation.id,
      replacements: replacementArray,
      copyFirst: true,
      copyTitle: `${selectedPresentation.name} - Filled ${new Date().toLocaleDateString()}`,
    });
  };

  // Get value from context for a placeholder - smart matching
  function getContextValue(placeholder: string, ctx: TemplateFillContext): string {
    const lower = placeholder.toLowerCase().replace(/[_\s-]/g, "");

    // Customer fields - flexible matching
    if (ctx.customer) {
      // Name variations
      if (lower.includes("customer") && lower.includes("name") || lower === "customername" || lower === "companyname" || lower === "company" || lower === "customer") {
        return ctx.customer.name || "";
      }
      // Industry
      if (lower.includes("industry") || lower === "vertical" || lower === "sector") {
        return ctx.customer.industry || "";
      }
      // Region
      if (lower.includes("region") || lower === "geo" || lower === "geography" || lower === "territory" || lower === "location") {
        return ctx.customer.region || "";
      }
      // Tier
      if (lower.includes("tier") || lower === "segment" || lower === "size" || lower === "accounttier") {
        return ctx.customer.tier || "";
      }
      // Full content/overview
      if (lower.includes("overview") || lower.includes("profile") || lower.includes("summary") || lower.includes("background") || lower.includes("content")) {
        return ctx.customer.content || "";
      }
      // Considerations/notes
      if (lower.includes("consideration") || lower.includes("caveat") || lower.includes("note") || lower.includes("warning")) {
        return ctx.customer.considerations?.join("\n• ") || "";
      }
      // Website
      if (lower.includes("website") || lower.includes("url") || lower.includes("site")) {
        return (ctx.customer as Record<string, unknown>).website as string || "";
      }
    }

    // Date fields
    if (lower.includes("date") || lower === "today" || lower === "currentdate") {
      return new Date().toLocaleDateString();
    }
    if (lower === "year" || lower === "currentyear") {
      return new Date().getFullYear().toString();
    }
    if (lower.includes("quarter") || lower === "q") {
      return `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    }

    // Skill matching - look for skill title in placeholder or placeholder in skill title
    if (ctx.skills && ctx.skills.length > 0) {
      // Direct skill title match
      const matchingSkill = ctx.skills.find((s) => {
        const skillLower = s.title.toLowerCase().replace(/[_\s-]/g, "");
        return skillLower.includes(lower) || lower.includes(skillLower);
      });
      if (matchingSkill) {
        return matchingSkill.content || "";
      }

      // If placeholder asks for "all skills" or similar
      if (lower.includes("allskill") || lower.includes("skillcontent") || lower === "skills") {
        return ctx.skills.map((s) => `## ${s.title}\n${s.content}`).join("\n\n");
      }
    }

    // Custom data from collateral planning (BVA, slide data, etc.)
    // This is the primary source for AI-generated slide content
    if (ctx.custom) {
      // Exact key match first
      if (ctx.custom[placeholder]) {
        return ctx.custom[placeholder];
      }
      // Case-insensitive key match
      const customKey = Object.keys(ctx.custom).find(
        (k) => k.toLowerCase().replace(/[_\s-]/g, "") === lower
      );
      if (customKey) {
        return ctx.custom[customKey];
      }
      // Partial match - placeholder contains key or key contains placeholder
      const partialMatch = Object.keys(ctx.custom).find((k) => {
        const keyLower = k.toLowerCase().replace(/[_\s-]/g, "");
        return lower.includes(keyLower) || keyLower.includes(lower);
      });
      if (partialMatch) {
        return ctx.custom[partialMatch];
      }
    }

    return "";
  }

  // Extract error message safely
  const errorMessage = presentationsError
    ? presentationsError instanceof Error
      ? presentationsError.message
      : typeof presentationsError === "string"
        ? presentationsError
        : "Failed to load presentations"
    : null;

  const hasAccess = !presentationsError;
  const needsReauth =
    errorMessage?.includes("sign out") ||
    errorMessage?.includes("access token");

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
        <Presentation className="h-3.5 w-3.5" />
        Google Slides
      </label>

      {/* Error state */}
      {presentationsError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800">
              {needsReauth ? (
                <>
                  <p className="font-medium">Google Slides access required</p>
                  <p className="mt-1">
                    Please sign out and sign in again to grant Slides permissions.
                  </p>
                </>
              ) : (
                <p>{errorMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search and list */}
      {hasAccess && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search presentations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-7 text-xs"
                disabled={disabled}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => refetchPresentations()}
              disabled={presentationsLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${presentationsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Presentation list */}
          {presentationsLoading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground text-xs">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading presentations...
            </div>
          ) : presentations && presentations.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {presentations.map((presentation) => (
                <button
                  key={presentation.id}
                  onClick={() => {
                    setSelectedPresentation(presentation);
                    setShowPlaceholderEditor(false);
                    setPlaceholders([]);
                    setReplacements({});
                  }}
                  disabled={disabled}
                  className={`w-full text-left p-2 rounded-md text-xs transition-colors ${
                    selectedPresentation?.id === presentation.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Presentation className="h-4 w-4 shrink-0 text-orange-500" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{presentation.name}</div>
                      {presentation.modifiedTime && (
                        <div className="text-muted-foreground text-[10px]">
                          Modified {new Date(presentation.modifiedTime).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    {selectedPresentation?.id === presentation.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              No presentations found
            </p>
          )}
        </>
      )}

      {/* Placeholder editor */}
      {selectedPresentation && showPlaceholderEditor && (
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              Placeholders ({placeholders.length})
            </span>
            {selectedPresentation.webViewLink && (
              <a
                href={selectedPresentation.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {placeholdersLoading ? (
            <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
              Scanning for placeholders...
            </div>
          ) : placeholders.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {placeholders.map((placeholder) => (
                <div key={placeholder} className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground">
                    {`{{${placeholder}}}`}
                  </label>
                  <Input
                    value={replacements[placeholder] || ""}
                    onChange={(e) =>
                      setReplacements((prev) => ({
                        ...prev,
                        [placeholder]: e.target.value,
                      }))
                    }
                    placeholder={`Value for ${placeholder}`}
                    className="h-7 text-xs"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              No {`{{placeholders}}`} found in this presentation
            </p>
          )}
        </div>
      )}

      {/* Fill button */}
      {selectedPresentation && (
        <Button
          variant="default"
          size="sm"
          className="w-full"
          disabled={
            disabled ||
            fillMutation.isPending ||
            placeholders.length === 0 ||
            Object.values(replacements).filter((v) => v.trim()).length === 0
          }
          onClick={handleFill}
        >
          {fillMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Filling...
            </>
          ) : (
            <>
              <Presentation className="h-4 w-4 mr-2" />
              Fill & Open Copy
            </>
          )}
        </Button>
      )}

      {/* Context hint */}
      {selectedPresentation && placeholders.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Creates a copy and fills placeholders. Original is not modified.
        </p>
      )}
    </div>
  );
}
