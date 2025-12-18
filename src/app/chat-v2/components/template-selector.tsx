"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileDown, Eye, Download, Loader2, Copy, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { TemplateResponse, FillTemplateResponse, TemplateFillContext } from "@/types/template";

type TemplateListItem = Omit<TemplateResponse, "content" | "placeholderHint">;

interface TemplateSelectorProps {
  context: TemplateFillContext;
  disabled?: boolean;
}

export function TemplateSelector({ context, disabled }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [filledContent, setFilledContent] = useState<string | null>(null);
  const [docxBase64, setDocxBase64] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch available templates
  const { data: templates, isLoading: templatesLoading } = useQuery<TemplateListItem[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      return data.data || [];
    },
  });

  // Fill template mutation
  const fillMutation = useMutation<FillTemplateResponse, Error, { templateId: string; outputFormat: "markdown" | "docx" }>({
    mutationFn: async ({ templateId, outputFormat }) => {
      const res = await fetch("/api/templates/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          context,
          outputFormat,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fill template");
      }
      const data = await res.json();
      return data.data;
    },
    onSuccess: (data) => {
      setFilledContent(data.filledContent);
      setDocxBase64(data.docxBase64 || null);
      setShowPreview(true);
      if (data.placeholdersMissing.length > 0) {
        toast.warning(`Some placeholders could not be filled: ${data.placeholdersMissing.join(", ")}`);
      } else {
        toast.success("Template filled successfully");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFillTemplate = (outputFormat: "markdown" | "docx" = "markdown") => {
    if (!selectedTemplate) {
      toast.error("Please select a template first");
      return;
    }
    fillMutation.mutate({ templateId: selectedTemplate.id, outputFormat });
  };

  const handleCopy = async () => {
    if (!filledContent) return;
    await navigator.clipboard.writeText(filledContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleDownloadMarkdown = () => {
    if (!filledContent || !selectedTemplate) return;
    const blob = new Blob([filledContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.name.toLowerCase().replace(/\s+/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  const handleDownloadDocx = () => {
    if (!docxBase64 || !selectedTemplate) {
      // If we don't have DOCX yet, request it
      handleFillTemplate("docx");
      return;
    }
    // Convert base64 to blob and download
    const byteCharacters = atob(docxBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.name.toLowerCase().replace(/\s+/g, "-")}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded as DOCX");
  };

  const hasContext = !!(
    context.customer ||
    context.skills?.length ||
    context.gtm?.gongCalls?.length ||
    context.gtm?.hubspotActivities?.length
  );

  return (
    <div className="space-y-3">
      {/* Template dropdown */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Select Template
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              disabled={disabled || templatesLoading}
            >
              {templatesLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              ) : selectedTemplate ? (
                <span className="truncate">{selectedTemplate.name}</span>
              ) : (
                "Choose a template..."
              )}
              <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Available Templates</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {templates && templates.length > 0 ? (
              templates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setFilledContent(null);
                    setDocxBase64(null);
                    setShowPreview(false);
                  }}
                  className="flex flex-col items-start"
                >
                  <span className="font-medium">{template.name}</span>
                  {template.description && (
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {template.description}
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No templates available</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Selected template info */}
      {selectedTemplate && (
        <div className="text-xs text-muted-foreground space-y-1">
          {selectedTemplate.category && (
            <div className="flex items-center gap-1">
              <span className="font-medium">Category:</span>
              <span className="capitalize">{selectedTemplate.category}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="font-medium">Output:</span>
            <span className="uppercase">{selectedTemplate.outputFormat}</span>
          </div>
        </div>
      )}

      {/* Context indicator */}
      {!hasContext && selectedTemplate && (
        <p className="text-xs text-amber-600">
          Select a customer or skills to provide context for the template
        </p>
      )}

      {/* Fill button */}
      <Button
        variant="default"
        size="sm"
        className="w-full"
        disabled={disabled || !selectedTemplate || fillMutation.isPending}
        onClick={() => handleFillTemplate("markdown")}
      >
        {fillMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Filling...
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4 mr-2" />
            Fill Template
          </>
        )}
      </Button>

      {/* Preview modal/section */}
      {showPreview && filledContent && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Preview</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setShowPreview(false)}
              >
                ×
              </Button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-2 bg-muted rounded-md">
            <pre className="text-xs whitespace-pre-wrap break-words font-mono">
              {filledContent.slice(0, 1000)}
              {filledContent.length > 1000 && "..."}
            </pre>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCopy}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDownloadMarkdown}
            >
              <Download className="h-3 w-3 mr-1" />
              .md
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDownloadDocx}
              disabled={fillMutation.isPending}
            >
              {fillMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              .docx
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
