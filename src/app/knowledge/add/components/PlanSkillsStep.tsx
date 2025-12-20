"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { SkipForward, AlertTriangle, X } from "lucide-react";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { Button } from "@/components/ui/button";
import { ConversationalPanel, Message } from "@/components/ui/conversational-panel";
import {
  useBulkImportStore,
  PlanningMessage,
  SkillPlan,
  SkillPlanItem,
} from "@/stores/bulk-import-store";
import PlanPreviewPanel from "./PlanPreviewPanel";

// Resizable panel constraints
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 500;
const DEFAULT_PANEL_WIDTH = 380;

type ExistingSkill = {
  id: string;
  title: string;
  content: string;
  sourceUrls: string[];
};

type PlanSkillsStepProps = {
  existingSkills: ExistingSkill[];
};

// Normalize URL for comparison (remove trailing slashes, lowercase)
function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

export default function PlanSkillsStep({ existingSkills }: PlanSkillsStepProps) {
  const {
    urlInput,
    uploadedDocuments,
    planningMessages,
    skillPlan,
    planningMode,
    addPlanningMessage,
    setSkillPlan,
    approveSkillPlan,
    skipPlanning,
    reset,
    setWorkflowStep,
  } = useBulkImportStore();

  const [input, setInput] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const hasInitializedRef = useRef(false);

  // Resizable panel
  const {
    panelWidth,
    isDragging,
    containerRef,
    handleMouseDown,
  } = useResizablePanel({
    storageKey: "skill-planning-panel-width",
    defaultWidth: DEFAULT_PANEL_WIDTH,
    minWidth: MIN_PANEL_WIDTH,
    maxWidth: MAX_PANEL_WIDTH,
  });

  // Parse URLs from input
  const urls = urlInput
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  // Check for duplicate URLs that already exist in skills
  const duplicateUrlInfo = useMemo(() => {
    const existingUrlMap = new Map<string, string[]>(); // normalized URL -> skill titles

    for (const skill of existingSkills) {
      for (const url of skill.sourceUrls) {
        const normalized = normalizeUrl(url);
        if (!existingUrlMap.has(normalized)) {
          existingUrlMap.set(normalized, []);
        }
        existingUrlMap.get(normalized)!.push(skill.title);
      }
    }

    const duplicates: { url: string; skills: string[] }[] = [];
    for (const url of urls) {
      const normalized = normalizeUrl(url);
      const matchingSkills = existingUrlMap.get(normalized);
      if (matchingSkills) {
        duplicates.push({ url, skills: matchingSkills });
      }
    }

    return {
      duplicates,
      allAreDuplicates: duplicates.length === urls.length && urls.length > 0,
      hasDuplicates: duplicates.length > 0,
    };
  }, [urls, existingSkills]);

  // Build source summaries for context
  const buildSourceSummaries = () => {
    const sources: {
      urls: { url: string; title?: string; preview?: string }[];
      documents: { id: string; filename: string; preview?: string }[];
    } = {
      urls: urls.map((url) => ({ url })),
      documents: uploadedDocuments.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        preview: doc.content.slice(0, 300) + (doc.content.length > 300 ? "..." : ""),
      })),
    };
    return sources;
  };

  // Build existing skills summaries
  const buildExistingSkillsSummaries = () => {
    return existingSkills.map((skill) => ({
      id: skill.id,
      title: skill.title,
      contentPreview: skill.content.slice(0, 200) + (skill.content.length > 200 ? "..." : ""),
    }));
  };

  // Parse skill plan from response
  const parseSkillPlan = (response: string): SkillPlan | null => {
    const planMatch = response.match(/---SKILL_PLAN---\s*([\s\S]*?)---END_PLAN---/);
    if (!planMatch) return null;

    const planContent = planMatch[1].trim();
    const skills: SkillPlanItem[] = [];
    let mergeWith: string | undefined;

    const lines = planContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for merge directive
      if (trimmed.toLowerCase().startsWith("merge with existing:")) {
        const mergeValue = trimmed.replace(/merge with existing:/i, "").trim();
        if (mergeValue.toLowerCase() !== "none") {
          mergeWith = mergeValue;
        }
        continue;
      }

      // Parse skill line
      const skillMatch = trimmed.match(/^-\s*(.+?):\s*Sources?:\s*(.+?),\s*Scope:\s*(.+?),\s*Questions?:\s*(.+)$/i);
      if (skillMatch) {
        const [, name, sourcesStr, scope, questionsStr] = skillMatch;
        skills.push({
          name: name.trim(),
          sources: sourcesStr.split(",").map((s) => s.trim()),
          scope: scope.trim(),
          questions: questionsStr.split(",").map((q) => q.trim()),
          mergeWith,
        });
      }
    }

    return skills.length > 0 ? { skills, approved: false } : null;
  };

  const cleanResponseForDisplay = (response: string): string => {
    const cleaned = response.replace(/---SKILL_PLAN---[\s\S]*?---END_PLAN---/, "").trim();
    if (cleaned !== response) {
      return cleaned + "\n\nI've created a skill plan based on our discussion. You can see it in the preview panel. Click **Accept Plan** when you're ready to proceed, or keep chatting to refine it.";
    }
    return response;
  };

  // Build initial message based on planning mode
  const buildInitialMessage = (): string => {
    if (planningMode.type === "merge") {
      const skillTitles = planningMode.skillIds
        .map(id => existingSkills.find(s => s.id === id)?.title)
        .filter(Boolean);
      return `I want to merge these skills: ${skillTitles.join(", ")}. Please analyze their content and help me combine them into a single unified skill. What overlaps do you see, and how should we structure the merged content?`;
    } else if (planningMode.type === "split") {
      const skill = existingSkills.find(s => s.id === planningMode.skillId);
      return `I want to split the skill "${skill?.title || "this skill"}" into multiple smaller, more focused skills. Please analyze its content and suggest how to divide it. What distinct topics or sections do you see?`;
    } else if (planningMode.type === "gap") {
      return `I need to create a new skill about "${planningMode.topic}". This was identified as a gap in my knowledge library. What sources would you recommend I add, and what key questions should this skill answer?`;
    }
    return "Please analyze the sources I've added and suggest how to organize them into skills. Look at the actual content and tell me what you see.";
  };

  // Build mode context for API (includes full skill content and source URLs for merge/split)
  const buildModeContext = () => {
    if (planningMode.type === "merge") {
      return {
        mode: "merge",
        skillsToMerge: planningMode.skillIds.map(id => {
          const skill = existingSkills.find(s => s.id === id);
          return skill ? {
            id: skill.id,
            title: skill.title,
            content: skill.content,
            sourceUrls: skill.sourceUrls,
          } : null;
        }).filter(Boolean),
      };
    } else if (planningMode.type === "split") {
      const skill = existingSkills.find(s => s.id === planningMode.skillId);
      return {
        mode: "split",
        skillToSplit: skill ? {
          id: skill.id,
          title: skill.title,
          content: skill.content,
          sourceUrls: skill.sourceUrls,
        } : null,
      };
    } else if (planningMode.type === "gap") {
      return {
        mode: "gap",
        topic: planningMode.topic,
      };
    }
    return { mode: "normal" };
  };

  // Initialize conversation by calling API to analyze sources
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (planningMessages.length > 0) return;

    hasInitializedRef.current = true;

    const initializeConversation = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/skills/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: buildInitialMessage(),
            conversationHistory: [],
            sources: buildSourceSummaries(),
            existingSkills: buildExistingSkillsSummaries(),
            modeContext: buildModeContext(),
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to initialize");
        }

        const data = await res.json();
        const response = data.data?.response || data.response || "";

        // Capture system prompt
        const prompt = data.data?.transparency?.systemPrompt || data.transparency?.systemPrompt;
        if (prompt) {
          setSystemPrompt(prompt);
        }

        // Check if response contains a plan
        const extractedPlan = parseSkillPlan(response);
        if (extractedPlan) {
          setSkillPlan(extractedPlan);
        }

        const displayResponse = cleanResponseForDisplay(response);
        addPlanningMessage({ role: "assistant", content: displayResponse });
      } catch {
        // Fallback to a simple message if API fails
        if (planningMode.type === "merge") {
          addPlanningMessage({
            role: "assistant",
            content: "I'll help you merge these skills. Tell me what you'd like the combined skill to focus on, and I'll suggest how to structure it.",
          });
        } else if (planningMode.type === "split") {
          addPlanningMessage({
            role: "assistant",
            content: "I'll help you split this skill into smaller pieces. What distinct topics would you like to separate out?",
          });
        } else if (planningMode.type === "gap") {
          addPlanningMessage({
            role: "assistant",
            content: `I'll help you create a skill about "${planningMode.topic}". What sources do you have, or would you like me to suggest what to cover?`,
          });
        } else {
          const urlText = urls.length > 0 ? `${urls.length} URL${urls.length > 1 ? "s" : ""}` : "";
          const docText = uploadedDocuments.length > 0 ? `${uploadedDocuments.length} document${uploadedDocuments.length > 1 ? "s" : ""}` : "";
          const sourceList = [urlText, docText].filter(Boolean).join(" and ");

          addPlanningMessage({
            role: "assistant",
            content: `I'll help you plan how to organize ${sourceList} into skills. What topics are these sources about?`,
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeConversation();
  }, [planningMode]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: PlanningMessage = { role: "user", content: input.trim() };
    addPlanningMessage(userMessage);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/skills/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: planningMessages,
          sources: buildSourceSummaries(),
          existingSkills: buildExistingSkillsSummaries(),
          modeContext: buildModeContext(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to get response");
      }

      const data = await res.json();
      const response = data.data?.response || data.response || "";

      // Capture system prompt if provided
      const prompt = data.data?.transparency?.systemPrompt || data.transparency?.systemPrompt;
      if (prompt && !systemPrompt) {
        setSystemPrompt(prompt);
      }

      // Check if response contains a plan
      const extractedPlan = parseSkillPlan(response);
      if (extractedPlan) {
        setSkillPlan(extractedPlan);
      }

      // Clean response for display
      const displayResponse = cleanResponseForDisplay(response);

      const assistantMessage: PlanningMessage = { role: "assistant", content: displayResponse };
      addPlanningMessage(assistantMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    skipPlanning();
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = () => {
    reset();
    setWorkflowStep("input");
  };

  // Convert PlanningMessage[] to Message[] for the ConversationalPanel
  const messages: Message[] = planningMessages;

  // Header component
  const header = (
    <div style={{
      padding: "16px 24px",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
          {planningMode.type === "merge" ? "Merge Skills" :
           planningMode.type === "split" ? "Split Skill" :
           planningMode.type === "gap" ? "Create New Skill" :
           "Plan Your Skills"}
        </h3>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>
          {planningMode.type === "merge" ? "Combine multiple skills into one" :
           planningMode.type === "split" ? "Divide a skill into focused pieces" :
           planningMode.type === "gap" ? "Fill a gap in your knowledge library" :
           "Discuss how to organize your sources before generating"}
        </p>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSkip}
        >
          <SkipForward className="h-4 w-4 mr-1" />
          Skip Planning
        </Button>
      </div>
    </div>
  );

  // Duplicate URL warning
  const headerExtras = duplicateUrlInfo.hasDuplicates ? (
    <div style={{
      padding: "12px 24px",
      backgroundColor: duplicateUrlInfo.allAreDuplicates ? "#fef3c7" : "#fefce8",
      borderBottom: "1px solid #fde68a",
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
    }}>
      <AlertTriangle size={18} style={{ color: "#d97706", flexShrink: 0, marginTop: "2px" }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: "13px", color: "#92400e", margin: 0, fontWeight: 500 }}>
          {duplicateUrlInfo.allAreDuplicates
            ? "All URLs already exist in your skill library"
            : `${duplicateUrlInfo.duplicates.length} of ${urls.length} URLs already exist in skills`}
        </p>
        <p style={{ fontSize: "12px", color: "#a16207", margin: "4px 0 0 0" }}>
          {duplicateUrlInfo.duplicates.slice(0, 2).map(d => (
            <span key={d.url}>
              {d.url.length > 40 ? d.url.slice(0, 40) + "..." : d.url} → <strong>{d.skills[0]}</strong>
              <br />
            </span>
          ))}
          {duplicateUrlInfo.duplicates.length > 2 && (
            <span>...and {duplicateUrlInfo.duplicates.length - 2} more</span>
          )}
        </p>
        {duplicateUrlInfo.allAreDuplicates && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkip}
            style={{ marginTop: "8px", backgroundColor: "#fff" }}
          >
            <SkipForward className="h-3 w-3 mr-1" />
            Skip to refresh existing skills
          </Button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Left Column - Chat */}
      <ConversationalPanel
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        isLoading={isLoading}
        loadingText="Thinking..."
        placeholder="Discuss how to organize your skills..."
        error={error}
        onErrorDismiss={() => setError(null)}
        header={header}
        headerExtras={headerExtras}
        systemPrompt={systemPrompt}
        systemPromptTitle="Planning System Prompt"
        textareaSize="lg"
      />

      {/* Resizable Divider */}
      <ResizableDivider
        isDragging={isDragging}
        onMouseDown={handleMouseDown}
      />

      {/* Right Column - Preview Panel */}
      <div style={{
        width: `${panelWidth}px`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8fafc",
        borderLeft: "1px solid #e2e8f0",
      }}>
        <PlanPreviewPanel
          plan={skillPlan}
          sourceCount={urls.length + uploadedDocuments.length}
          existingSkillCount={existingSkills.length}
          onAccept={approveSkillPlan}
          onSkip={handleSkip}
        />
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#fef3c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <AlertTriangle size={20} style={{ color: "#d97706" }} />
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b", margin: 0 }}>
                Cancel skill planning?
              </h3>
            </div>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px 0" }}>
              Your conversation and any plan you&apos;ve created will be lost. You&apos;ll need to start over.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Button
                variant="outline"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep planning
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmCancel}
              >
                Cancel and start over
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
