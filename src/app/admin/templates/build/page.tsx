"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { Button } from "@/components/ui/button";
import { ConversationalPanel, type Message } from "@/components/ui/conversational-panel";
import { toast } from "sonner";
import TemplatePlanPreviewPanel, {
  type TemplatePlan,
  type TemplatePlanItem,
} from "./components/TemplatePlanPreviewPanel";

// Resizable panel constraints
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 500;
const DEFAULT_PANEL_WIDTH = 380;

const SYSTEM_PROMPT = `You are a template building assistant. Help users create slide deck templates by understanding their placeholder needs.

When a user describes their template or pastes a list of placeholders, analyze it and respond with a structured template definition.

## Input Formats You Accept:
1. Field list format: "FieldName[Description]" per line
2. Natural language description of what the template should contain
3. Example slide content with placeholders

## Your Response Format:
When you have enough information to build a template, output it in this exact format:

---TEMPLATE_DEFINITION---
Name: [Template Name]
Description: [Brief description of template purpose]
Category: [bva|battlecard|one-pager|qbr|other]
Placeholders:
- [Key]: [Description]
- [Key]: [Description]
...
---END_TEMPLATE---

## Guidelines:
- Parse FieldName[Description] format automatically
- Suggest appropriate categories based on content
- Group related fields logically
- Keep placeholder keys concise but descriptive
- Include descriptions for each field

If the user's input is unclear, ask clarifying questions. Once you have a complete picture, output the template definition.`;

// Parse template definition from AI response
function parseTemplateDefinition(response: string): TemplatePlan | null {
  const templateMatch = response.match(
    /---TEMPLATE_DEFINITION---\s*([\s\S]*?)\s*---END_TEMPLATE---/
  );

  if (!templateMatch) return null;

  const content = templateMatch[1];
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let name = "";
  let description = "";
  let category = "other";
  const placeholders: TemplatePlanItem[] = [];

  let inPlaceholders = false;

  for (const line of lines) {
    if (line.startsWith("Name:")) {
      name = line.replace("Name:", "").trim();
    } else if (line.startsWith("Description:")) {
      description = line.replace("Description:", "").trim();
    } else if (line.startsWith("Category:")) {
      category = line.replace("Category:", "").trim().toLowerCase();
    } else if (line.startsWith("Placeholders:")) {
      inPlaceholders = true;
    } else if (inPlaceholders && line.startsWith("-")) {
      const placeholderLine = line.slice(1).trim();
      const colonIdx = placeholderLine.indexOf(":");
      if (colonIdx > 0) {
        placeholders.push({
          key: placeholderLine.slice(0, colonIdx).trim(),
          description: placeholderLine.slice(colonIdx + 1).trim(),
        });
      } else {
        placeholders.push({ key: placeholderLine, description: "" });
      }
    }
  }

  if (!name || placeholders.length === 0) return null;

  return { name, description, category, placeholders };
}

// Clean response for display (remove the structured output block)
function cleanResponseForDisplay(response: string): string {
  const cleaned = response.replace(/---TEMPLATE_DEFINITION---[\s\S]*?---END_TEMPLATE---/, "").trim();
  if (cleaned !== response) {
    return (
      cleaned +
      "\n\nI've created a template based on your input. You can see it in the preview panel. Click **Create Template** when you're ready, or keep chatting to refine it."
    );
  }
  return response;
}

// Generate template markdown content
function generateTemplateContent(plan: TemplatePlan): string {
  const lines = [`# ${plan.name}`, ""];

  for (const p of plan.placeholders) {
    lines.push(`## ${p.key}`);
    if (p.description) {
      lines.push(`<!-- ${p.description} -->`);
    }
    lines.push(`{{${p.key}}}`);
    lines.push("");
  }

  return lines.join("\n");
}

export default function TemplateBuilderPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templatePlan, setTemplatePlan] = useState<TemplatePlan | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const hasInitializedRef = useRef(false);

  // Resizable panel
  const { panelWidth, isDragging, containerRef, handleMouseDown } = useResizablePanel({
    storageKey: "template-builder-panel-width",
    defaultWidth: DEFAULT_PANEL_WIDTH,
    minWidth: MIN_PANEL_WIDTH,
    maxWidth: MAX_PANEL_WIDTH,
  });

  // Initialize conversation
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (messages.length > 0) return;

    hasInitializedRef.current = true;

    setMessages([
      {
        role: "assistant",
        content: `I'll help you build a template. You can:

1. **Paste a list** of placeholders in this format:
\`\`\`
Customer[Company name]
Goal 1[Primary initiative]
Summary[Overview in 50 words]
\`\`\`

2. **Describe what you need**: "I need a BVA template with customer info, goals, and ROI sections"

3. **Share example content** and I'll extract the placeholders

What would you like to create?`,
      },
    ]);
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/templates/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          conversationHistory: messages,
          systemPrompt: SYSTEM_PROMPT,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to get response");
      }

      const data = await res.json();
      const response = data.data?.response || data.response || "";

      // Check if response contains a template definition
      const extractedPlan = parseTemplateDefinition(response);
      if (extractedPlan) {
        setTemplatePlan(extractedPlan);
        toast.success(`Template "${extractedPlan.name}" is ready!`);
      }

      // Clean response for display
      const displayResponse = cleanResponseForDisplay(response);
      setMessages((prev) => [...prev, { role: "assistant", content: displayResponse }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!templatePlan) return;

    try {
      const content = generateTemplateContent(templatePlan);

      // Create the template via API
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templatePlan.name,
          description: templatePlan.description,
          content,
          category: templatePlan.category,
          outputFormat: "markdown",
          isActive: true,
          sortOrder: 0,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create template");
      }

      toast.success("Template created successfully!");
      router.push("/admin/templates");
    } catch {
      toast.error("Failed to create template");
    }
  };

  const handleSkip = () => {
    router.push("/admin/templates");
  };

  const handleCancel = () => {
    if (messages.length > 1 || templatePlan) {
      setShowCancelConfirm(true);
    } else {
      router.push("/admin/templates");
    }
  };

  // Header component
  const header = (
    <div
      style={{
        padding: "16px 24px",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <Link href="/admin/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
            Build Template
          </h3>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>
            AI-assisted template creation
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCancel}>
        <X className="h-4 w-4 mr-1" />
        Cancel
      </Button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Left Column - Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ConversationalPanel
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          loadingText="Analyzing..."
          placeholder="Describe your template or paste placeholder list..."
          error={error}
          onErrorDismiss={() => setError(null)}
          header={header}
          showSystemPromptButton={false}
        />
      </div>

      {/* Resizable Divider */}
      <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />

      {/* Right Column - Preview Panel */}
      <div
        style={{
          width: `${panelWidth}px`,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f8fafc",
          borderLeft: "1px solid #e2e8f0",
        }}
      >
        <TemplatePlanPreviewPanel plan={templatePlan} onAccept={handleAccept} onSkip={handleSkip} />
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#fef3c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertTriangle size={20} style={{ color: "#d97706" }} />
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
                Cancel template building?
              </h3>
            </div>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px 0" }}>
              Your conversation and any template you&apos;ve created will be lost.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
                Keep building
              </Button>
              <Button variant="destructive" onClick={() => router.push("/admin/templates")}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
