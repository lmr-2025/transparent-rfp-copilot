"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Check, Plus, FileText, Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationalPanel, type Message } from "@/components/ui/conversational-panel";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { toast } from "sonner";
import type { CustomerProfile } from "@/types/customerProfile";
import type { Skill } from "@/types/skill";
import type { ReferenceUrl } from "@/types/referenceUrl";
import { SlideDataPreviewPanel } from "./components/SlideDataPreviewPanel";
import { GoogleSlidesPicker } from "./components/GoogleSlidesPicker";
import { FinishStepPanel } from "./components/FinishStepPanel";
import { CollapsibleKnowledgeSidebar } from "@/app/chat-v2/components/collapsible-knowledge-sidebar";
import { ContextControlsBar, type InstructionPreset } from "@/app/chat-v2/components/context-controls-bar";
import { TransparencyModal, type TransparencyData } from "@/components/chat/transparency-modal";
import type { TemplateFillContext } from "@/types/template";
import { useSelectionStore } from "@/stores/selection-store";
import { STORAGE_KEYS, DEFAULTS } from "@/lib/constants";

// Workflow steps - combined select/build into step 1
type WorkflowStep = "choose_template" | "build_template" | "generate_content" | "fill_slides" | "finish";

// Resizable panel constraints
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 500;
const DEFAULT_PANEL_WIDTH = 380;

type SlideData = Record<string, string>;

type TemplateInfo = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  content?: string;
  placeholders?: string[];
  instructionPresetId?: string | null;
};

type TemplatePlan = {
  name: string;
  description: string;
  category: string;
  placeholders: { key: string; description: string }[];
};

// Progress steps component
function ProgressSteps({ currentStep, isBuildingTemplate }: { currentStep: WorkflowStep; isBuildingTemplate?: boolean }) {
  // Show different steps based on whether building or selecting
  const STEPS = isBuildingTemplate ? [
    { id: "choose_template", label: "Choose Template" },
    { id: "build_template", label: "Build Template" },
    { id: "generate_content", label: "Generate Content" },
    { id: "fill_slides", label: "Fill Slides" },
    { id: "finish", label: "Finish" },
  ] : [
    { id: "choose_template", label: "Choose Template" },
    { id: "generate_content", label: "Generate Content" },
    { id: "fill_slides", label: "Fill Slides" },
    { id: "finish", label: "Finish" },
  ];

  const currentIdx = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      {STEPS.map((step, idx) => {
        const isActive = step.id === currentStep;
        const isComplete = idx < currentIdx;

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: isComplete ? "#22c55e" : isActive ? "#6366f1" : "#e2e8f0",
                color: isComplete || isActive ? "#fff" : "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {isComplete ? <Check size={14} /> : idx + 1}
            </div>
            <span
              style={{
                fontSize: "13px",
                color: isActive ? "#6366f1" : "#64748b",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                style={{
                  width: "24px",
                  height: "2px",
                  backgroundColor: isComplete ? "#22c55e" : "#e2e8f0",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Template builder system prompt
const TEMPLATE_BUILD_PROMPT = `You are a template building assistant. Help users create slide deck templates by understanding their placeholder needs.

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
  const templateMatch = response.match(/---TEMPLATE_DEFINITION---\s*([\s\S]*?)\s*---END_TEMPLATE---/);
  if (!templateMatch) return null;

  const content = templateMatch[1];
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);

  let name = "";
  let description = "";
  let category = "other";
  const placeholders: { key: string; description: string }[] = [];
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

// Clean response for display
function cleanTemplateResponse(response: string): string {
  const cleaned = response.replace(/---TEMPLATE_DEFINITION---[\s\S]*?---END_TEMPLATE---/, "").trim();
  if (cleaned !== response) {
    return cleaned + "\n\nI've created a template based on your input. You can see it in the preview panel. Click **Save & Continue** when ready.";
  }
  return response;
}

export default function CollateralBuilderPage() {
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("choose_template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isBuildingTemplate, setIsBuildingTemplate] = useState(false);

  // Instruction preset state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [userInstructions, setUserInstructions] = useState<string>("");

  // Template builder state
  const [buildMessages, setBuildMessages] = useState<Message[]>([]);
  const [buildInput, setBuildInput] = useState("");
  const [templatePlan, setTemplatePlan] = useState<TemplatePlan | null>(null);

  // Content generation state
  const [contentMessages, setContentMessages] = useState<Message[]>([]);
  const [contentInput, setContentInput] = useState("");
  const [slideData, setSlideData] = useState<SlideData | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  // Finish step state - track completed slides
  const [completedSlidesId, setCompletedSlidesId] = useState<string | null>(null);
  const [completedSlidesUrl, setCompletedSlidesUrl] = useState<string | null>(null);

  // Transparency modal state
  const [showTransparency, setShowTransparency] = useState(false);
  const [transparencyData, setTransparencyData] = useState<TransparencyData | null>(null);

  // Selection store for knowledge context
  const { skillSelections } = useSelectionStore();

  // Resizable panel
  const { panelWidth, isDragging, containerRef, handleMouseDown } = useResizablePanel({
    storageKey: "collateral-builder-panel-width",
    defaultWidth: DEFAULT_PANEL_WIDTH,
    minWidth: MIN_PANEL_WIDTH,
    maxWidth: MAX_PANEL_WIDTH,
  });

  // Fetch customers
  const { data: customers = [], isLoading: customersLoading } = useApiQuery<CustomerProfile[]>({
    queryKey: ["customers"],
    url: "/api/customers",
    responseKey: "profiles",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Fetch skills
  const { data: skills = [], isLoading: skillsLoading } = useApiQuery<Skill[]>({
    queryKey: ["skills"],
    url: "/api/skills",
    responseKey: "skills",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Fetch documents
  const { data: documents = [], isLoading: docsLoading } = useApiQuery<{ id: string; title: string; filename: string }[]>({
    queryKey: ["documents"],
    url: "/api/documents",
    responseKey: "documents",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Fetch URLs
  const { data: urls = [], isLoading: urlsLoading } = useApiQuery<ReferenceUrl[]>({
    queryKey: ["urls"],
    url: "/api/reference-urls",
    responseKey: "urls",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Fetch templates
  const { data: templates = [], refetch: refetchTemplates } = useApiQuery<TemplateInfo[]>({
    queryKey: ["templates"],
    url: "/api/templates",
    responseKey: "data",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Fetch instruction presets (for system prompt preview)
  const { data: presets = [] } = useApiQuery<InstructionPreset[]>({
    queryKey: ["instruction-presets"],
    url: "/api/instruction-presets",
    responseKey: "presets",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Fetch planning data
  const { data: planningData } = useApiQuery<{ systemPrompt: string }>({
    queryKey: ["collateral-plan-setup"],
    url: "/api/collateral/plan",
  });

  useEffect(() => {
    if (planningData?.systemPrompt) {
      setSystemPrompt(planningData.systemPrompt);
    }
  }, [planningData]);

  // Load user instructions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_INSTRUCTIONS);
    setUserInstructions(stored || DEFAULTS.USER_INSTRUCTIONS);
  }, []);

  // Handle preset change
  const handlePresetChange = useCallback((preset: InstructionPreset | null) => {
    setSelectedPresetId(preset?.id || null);
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const isContextLoading = customersLoading || skillsLoading || docsLoading || urlsLoading;

  // Initialize build conversation
  useEffect(() => {
    if (workflowStep === "build_template" && buildMessages.length === 0) {
      setBuildMessages([
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

What would you like to create?`,
        },
      ]);
    }
  }, [workflowStep, buildMessages.length]);

  // Initialize content generation conversation
  useEffect(() => {
    if (workflowStep === "generate_content" && contentMessages.length === 0 && selectedTemplate) {
      const placeholderList = selectedTemplate.placeholders?.join(", ") || "various fields";
      setContentMessages([
        {
          role: "assistant",
          content: selectedCustomer
            ? `I'm ready to generate content for **${selectedTemplate.name}** for **${selectedCustomer.name}**.

This template has these placeholders: ${placeholderList}

Tell me what specific content you need, or say "generate all" to fill in everything based on the customer profile and available knowledge.`
            : `I'm ready to generate content for **${selectedTemplate.name}**.

This template has these placeholders: ${placeholderList}

Select a customer above, or describe what content you need.`,
        },
      ]);
    }
  }, [workflowStep, contentMessages.length, selectedTemplate, selectedCustomer]);

  // Template build mutation
  const buildMutation = useApiMutation<{ response: string }, { message: string; conversationHistory: Message[]; systemPrompt: string }>({
    url: "/api/templates/build",
    method: "POST",
    onSuccess: (data) => {
      const parsed = parseTemplateDefinition(data.response);
      if (parsed) {
        setTemplatePlan(parsed);
        toast.success(`Template "${parsed.name}" is ready!`);
      }
      const displayResponse = cleanTemplateResponse(data.response);
      setBuildMessages((prev) => [...prev, { role: "assistant", content: displayResponse }]);
    },
    onError: (error) => toast.error(error.message),
  });

  // Get selected skills for context
  const selectedSkillIds = useMemo(() => {
    return Array.from(skillSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);
  }, [skillSelections]);

  const selectedSkillsContent = useMemo(() => {
    return skills
      .filter((s) => selectedSkillIds.includes(s.id))
      .map((s) => ({ id: s.id, title: s.title, content: s.content }));
  }, [skills, selectedSkillIds]);

  // Content generation mutation
  const contentMutation = useApiMutation<{ response: string; slideData?: SlideData }, { message: string; conversationHistory: Message[]; context: unknown }>({
    url: "/api/collateral/plan",
    method: "POST",
    onSuccess: (data) => {
      setContentMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      if (data.slideData && Object.keys(data.slideData).length > 0) {
        setSlideData(data.slideData);
        toast.success(`Generated ${Object.keys(data.slideData).length} fields!`);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const handleBuildSend = useCallback(() => {
    if (!buildInput.trim() || buildMutation.isPending) return;
    const userMessage: Message = { role: "user", content: buildInput.trim() };
    setBuildMessages((prev) => [...prev, userMessage]);
    const messageToSend = buildInput.trim();
    setBuildInput("");
    buildMutation.mutate({
      message: messageToSend,
      conversationHistory: buildMessages,
      systemPrompt: TEMPLATE_BUILD_PROMPT,
    });
  }, [buildInput, buildMutation, buildMessages]);

  const handleContentSend = useCallback(() => {
    if (!contentInput.trim() || contentMutation.isPending) return;
    const userMessage: Message = { role: "user", content: contentInput.trim() };
    setContentMessages((prev) => [...prev, userMessage]);
    const messageToSend = contentInput.trim();
    setContentInput("");
    contentMutation.mutate({
      message: messageToSend,
      conversationHistory: contentMessages,
      context: {
        userInstructions: userInstructions || undefined,
        customer: selectedCustomer ? {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          industry: selectedCustomer.industry || undefined,
          content: selectedCustomer.content || undefined,
        } : undefined,
        skills: selectedSkillsContent.length > 0 ? selectedSkillsContent : skills.slice(0, 15).map((s) => ({
          id: s.id,
          title: s.title,
          contentPreview: s.content.slice(0, 200),
        })),
        template: selectedTemplate ? {
          id: selectedTemplate.id,
          name: selectedTemplate.name,
          category: selectedTemplate.category,
          content: selectedTemplate.content,
        } : undefined,
      },
    });
  }, [contentInput, contentMutation, contentMessages, userInstructions, selectedCustomer, selectedSkillsContent, skills, selectedTemplate]);

  const handleSaveTemplate = async () => {
    if (!templatePlan) return;

    try {
      const content = templatePlan.placeholders.map((p) => `## ${p.key}\n{{${p.key}}}`).join("\n\n");

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templatePlan.name,
          description: templatePlan.description,
          content: `# ${templatePlan.name}\n\n${content}`,
          category: templatePlan.category,
          outputFormat: "markdown",
          isActive: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to save template");

      const data = await res.json();
      toast.success("Template saved!");
      await refetchTemplates();
      setSelectedTemplateId(data.data.id);
      setWorkflowStep("generate_content");
    } catch {
      toast.error("Failed to save template");
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    setSelectedTemplateId(templateId);

    // Auto-select linked instruction preset if template has one
    if (template?.instructionPresetId) {
      setSelectedPresetId(template.instructionPresetId);
    }

    setWorkflowStep("generate_content");
  };

  const handleBuildNew = () => {
    setIsBuildingTemplate(true);
    setWorkflowStep("build_template");
  };

  const handleBackToChoose = () => {
    setIsBuildingTemplate(false);
    setWorkflowStep("choose_template");
  };

  const handleSlidesFilled = (data: { presentationId: string; webViewLink: string }) => {
    setCompletedSlidesId(data.presentationId);
    setCompletedSlidesUrl(data.webViewLink);
    setWorkflowStep("finish");
  };

  const handleNewCollateral = () => {
    // Reset all state for a new collateral
    setWorkflowStep("choose_template");
    setSelectedTemplateId(null);
    setIsBuildingTemplate(false);
    setBuildMessages([]);
    setBuildInput("");
    setTemplatePlan(null);
    setContentMessages([]);
    setContentInput("");
    setSlideData(null);
    setCompletedSlidesId(null);
    setCompletedSlidesUrl(null);
  };

  // Build transparency data for system prompt preview
  const handlePreviewPrompt = useCallback(() => {
    const selectedSkillsList = skills.filter((s) => selectedSkillIds.includes(s.id));

    // Get the selected preset's content
    const selectedPreset = presets.find((p) => p.id === selectedPresetId);
    const presetContent = selectedPreset?.content || userInstructions;

    // Build the system prompt based on current step and template
    let currentSystemPrompt = "";

    if (workflowStep === "build_template") {
      currentSystemPrompt = "You are helping build a collateral template. Extract placeholder definitions from user input and structure them appropriately.";
    } else if (workflowStep === "generate_content" || workflowStep === "choose_template") {
      // Show template-specific prompt when a template is selected
      if (selectedTemplate) {
        const placeholders = selectedTemplate.placeholders?.join(", ") || "various fields";
        currentSystemPrompt = `You are generating content for the "${selectedTemplate.name}" template.

**Template Placeholders:** ${placeholders}

**Your Instructions (Persona):**
${presetContent}

Use the provided customer information and knowledge sources to fill in template placeholders with relevant, accurate content. Output in the structured format for slide data extraction.`;
      } else {
        currentSystemPrompt = presetContent
          ? `**Your Instructions (Persona):**\n${presetContent}\n\nSelect a template to see the full system prompt for content generation.`
          : "Select a template to view the system prompt for content generation.";
      }
    } else {
      currentSystemPrompt = systemPrompt || "Collateral Builder system prompt";
    }

    // Build knowledge context from selected skills
    const knowledgeContext = selectedSkillsList.length > 0
      ? selectedSkillsList.map((s) => `## ${s.title}\n${s.content}`).join("\n\n")
      : "No skills selected";

    // Build customer context
    const customerContext = selectedCustomer
      ? `Customer: ${selectedCustomer.name}${selectedCustomer.industry ? ` (${selectedCustomer.industry})` : ""}`
      : undefined;

    const data: TransparencyData = {
      systemPrompt: currentSystemPrompt,
      knowledgeContext,
      customerContext,
      model: "claude-sonnet-4-20250514",
      maxTokens: 4096,
      temperature: 0.7,
    };

    setTransparencyData(data);
    setShowTransparency(true);
  }, [skills, selectedSkillIds, selectedCustomer, systemPrompt, workflowStep, selectedTemplate, presets, selectedPresetId, userInstructions]);

  const templateContext: TemplateFillContext = useMemo(() => ({
    customer: selectedCustomer ? {
      id: selectedCustomer.id,
      name: selectedCustomer.name,
      industry: selectedCustomer.industry || undefined,
    } : undefined,
    skills: selectedSkillsContent.length > 0 ? selectedSkillsContent : skills.map((s) => ({ id: s.id, title: s.title, content: s.content })),
    custom: slideData || undefined,
  }), [selectedCustomer, selectedSkillsContent, skills, slideData]);

  // Header with page title, controls, and progress steps
  const header = (
    <div style={{ borderBottom: "1px solid #e2e8f0" }}>
      {/* Page Header Row */}
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
        <h1 style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
          Collateral Builder
        </h1>
        <a
          href="/chat-v2"
          style={{ fontSize: "14px", color: "#64748b", textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#6366f1")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
        >
          ← Back to Knowledge Chat
        </a>
      </div>
      {/* Controls Row - System Prompt, Start Over, Progress Steps */}
      <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPrompt}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            System Prompt
          </Button>
          {workflowStep !== "choose_template" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewCollateral}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Start Over
            </Button>
          )}
        </div>
        <ProgressSteps currentStep={workflowStep} isBuildingTemplate={isBuildingTemplate} />
      </div>
      {/* Combined Persona + Customer Controls */}
      <ContextControlsBar
        selectedPresetId={selectedPresetId}
        onPresetChange={handlePresetChange}
        userInstructions={userInstructions}
        onUserInstructionsChange={setUserInstructions}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onCustomerSelect={setSelectedCustomerId}
        customersLoading={customersLoading}
      />
    </div>
  );

  return (
    <div ref={containerRef} style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Main Area (Header + Content) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Header */}
        {header}

        {/* Content Area - flex row */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
          {/* Left - Main Content Area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {/* Step 1: Choose Template (select existing or build new) */}
          {workflowStep === "choose_template" && (
            <div style={{ flex: 1, padding: "24px", overflowY: "auto", minHeight: 0 }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Choose a Template</h2>
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>
                Select an existing template or build a new one
              </p>

              {/* Build New Template Card */}
              <button
                onClick={handleBuildNew}
                style={{
                  width: "100%",
                  padding: "20px",
                  backgroundColor: "#f0f9ff",
                  border: "2px dashed #6366f1",
                  borderRadius: "8px",
                  textAlign: "left",
                  cursor: "pointer",
                  marginBottom: "24px",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", backgroundColor: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "15px", color: "#1e293b" }}>Build New Template</div>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>Create a custom template with AI assistance</div>
                  </div>
                </div>
              </button>

              {/* Existing Templates */}
              {templates.length > 0 && (
                <>
                  <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#64748b", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Existing Templates
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                    {templates.map((template) => (
                      <button
                        type="button"
                        key={template.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectTemplate(template.id);
                        }}
                        style={{
                          padding: "16px",
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
                            {template.name}
                          </span>
                        </div>
                        {template.description && (
                          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
                            {template.description}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {template.category && (
                            <span style={{ fontSize: "11px", backgroundColor: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "4px" }}>
                              {template.category}
                            </span>
                          )}
                          {template.instructionPresetId && (
                            <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "4px" }}>
                              Has linked persona
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Build Template (optional) */}
          {workflowStep === "build_template" && (
            <ConversationalPanel
              messages={buildMessages}
              input={buildInput}
              onInputChange={setBuildInput}
              onSend={handleBuildSend}
              isLoading={buildMutation.isPending}
              loadingText="Analyzing..."
              placeholder="Describe your template or paste placeholder list..."
              showSystemPromptButton={false}
              textareaSize="lg"
            />
          )}

          {/* Step 3: Generate Content */}
          {workflowStep === "generate_content" && (
            <ConversationalPanel
              messages={contentMessages}
              input={contentInput}
              onInputChange={setContentInput}
              onSend={handleContentSend}
              isLoading={contentMutation.isPending}
              loadingText="Generating..."
              placeholder={selectedCustomer ? `Generate content for ${selectedCustomer.name}...` : "Select a customer to get started..."}
              systemPrompt={systemPrompt}
              systemPromptTitle="Collateral Builder Prompt"
              textareaSize="lg"
            />
          )}

          {/* Step 4: Fill Slides */}
          {workflowStep === "fill_slides" && (
            <div style={{ flex: 1, padding: "16px", overflow: "auto", minHeight: 0 }}>
              <GoogleSlidesPicker
                context={templateContext}
                onFillComplete={handleSlidesFilled}
              />
            </div>
          )}

          {/* Step 5: Finish - left side is empty, content is in right panel */}
          {workflowStep === "finish" && (
            <div style={{ flex: 1 }} />
          )}
        </div>

        {/* Resizable Divider */}
        <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />

        {/* Right Column - Preview Panel */}
        <div style={{ width: `${panelWidth}px`, flexShrink: 0, display: "flex", flexDirection: "column", backgroundColor: "#f8fafc", borderLeft: "1px solid #e2e8f0", overflow: "hidden" }}>
          {workflowStep === "finish" ? (
          // Finish Step Panel
          <FinishStepPanel
            data={{
              name: selectedTemplate?.name || templatePlan?.name || "Untitled Collateral",
              templateId: selectedTemplateId || undefined,
              templateName: selectedTemplate?.name || templatePlan?.name,
              customerId: selectedCustomerId || undefined,
              customerName: selectedCustomer?.name,
              filledContent: slideData || undefined,
              googleSlidesId: completedSlidesId || undefined,
              googleSlidesUrl: completedSlidesUrl || undefined,
            }}
            onBack={() => setWorkflowStep("fill_slides")}
            onNewCollateral={handleNewCollateral}
          />
        ) : workflowStep === "build_template" ? (
          // Template Preview
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b", margin: 0 }}>Template Preview</h3>
            </div>
            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", minHeight: 0 }}>
              {templatePlan ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b", marginBottom: "4px" }}>{templatePlan.name}</div>
                    {templatePlan.description && <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>{templatePlan.description}</div>}
                    <span style={{ fontSize: "11px", backgroundColor: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "4px" }}>{templatePlan.category}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 500 }}>
                      {templatePlan.placeholders.length} Placeholders
                    </span>
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {templatePlan.placeholders.map((p, idx) => (
                        <div key={idx} style={{ padding: "8px 10px", backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                          <div style={{ fontSize: "13px", fontWeight: 500, color: "#1e293b" }}>{p.key}</div>
                          {p.description && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{p.description}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", color: "#64748b" }}>
                  <p style={{ fontSize: "14px", margin: "0 0 8px 0", color: "#475569" }}>No template yet</p>
                  <p style={{ fontSize: "13px", margin: 0 }}>Describe your template to get started</p>
                </div>
              )}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Button onClick={handleSaveTemplate} disabled={!templatePlan} className="w-full">
                <Check className="h-4 w-4 mr-2" />
                Save & Continue
              </Button>
              <Button variant="outline" onClick={handleBackToChoose} className="w-full">
                Back to Templates
              </Button>
            </div>
          </div>
        ) : (
          // Slide Data Preview (for content generation step)
          <SlideDataPreviewPanel
            data={slideData}
            onFillSlides={() => setWorkflowStep("fill_slides")}
            onClear={() => setSlideData(null)}
            onUpdateField={(key, value) => setSlideData((prev) => (prev ? { ...prev, [key]: value } : { [key]: value }))}
          />
        )}
        </div>
        </div>
      </div>

      {/* Right Sidebar - Knowledge Context (collapsible, full height) */}
      <CollapsibleKnowledgeSidebar
        skills={skills}
        documents={documents}
        urls={urls}
        customers={customers}
        selectedCustomer={selectedCustomer}
        isLoading={isContextLoading}
      />

      {/* Transparency Modal */}
      {transparencyData && (
        <TransparencyModal
          open={showTransparency}
          onClose={() => setShowTransparency(false)}
          data={transparencyData}
          isPreview={true}
        />
      )}
    </div>
  );
}
