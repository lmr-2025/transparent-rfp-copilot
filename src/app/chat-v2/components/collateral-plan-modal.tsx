"use client";

import { useState, useCallback } from "react";
import { X, FileText, Sparkles, CheckCircle, Loader2, Presentation, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationalPanel, type Message } from "@/components/ui/conversational-panel";
import { toast } from "sonner";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import type { CustomerProfile } from "@/types/customerProfile";
import type { Skill } from "@/types/skill";
import type { CustomerGTMData } from "@/types/gtmData";

// Parsed collateral plan item
type CollateralItem = {
  name: string;
  type: string;
  template: string;
  priority: string;
  sections: string[];
  focus: string;
};

// Collateral plan from API
type CollateralPlan = {
  collateral: CollateralItem[];
};

// Key-value data for slide filling
type SlideData = Record<string, string>;

// Template info from API
type TemplateInfo = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

interface CollateralPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerProfile | null;
  skills: Skill[];
  gtmData: CustomerGTMData | null;
  onApplyPlan?: (plan: CollateralPlan) => void;
  onFillSlides?: (data: SlideData) => void;
}

export function CollateralPlanModal({
  isOpen,
  onClose,
  customer,
  skills,
  gtmData,
  onApplyPlan,
  onFillSlides,
}: CollateralPlanModalProps) {
  const { data: planningData, isLoading: isLoadingPrompt } = useApiQuery<{
    systemPrompt: string;
    templates: TemplateInfo[];
  }>({
    queryKey: ["collateral-plan-setup"],
    url: "/api/collateral/plan",
    enabled: isOpen,
  });

  if (!isOpen) {
    return null;
  }

  const systemPrompt = planningData?.systemPrompt || "";
  const templates = planningData?.templates || [];
  const sessionKey = [
    customer?.id ?? "none",
    skills.length,
    gtmData?.gongCalls.length ?? 0,
    gtmData?.hubspotActivities.length ?? 0,
    templates.length,
    systemPrompt.length,
    planningData ? "ready" : "loading",
  ].join("|");

  return (
    <CollateralPlanModalContent
      key={sessionKey}
      onClose={onClose}
      customer={customer}
      skills={skills}
      gtmData={gtmData}
      onApplyPlan={onApplyPlan}
      onFillSlides={onFillSlides}
      isLoadingPrompt={isLoadingPrompt}
      systemPrompt={systemPrompt}
      templates={templates}
    />
  );
}

type CollateralPlanModalContentProps = {
  onClose: () => void;
  customer: CustomerProfile | null;
  skills: Skill[];
  gtmData: CustomerGTMData | null;
  onApplyPlan?: (plan: CollateralPlan) => void;
  onFillSlides?: (data: SlideData) => void;
  isLoadingPrompt: boolean;
  systemPrompt: string;
  templates: TemplateInfo[];
};

function CollateralPlanModalContent({
  onClose,
  customer,
  skills,
  gtmData,
  onApplyPlan,
  onFillSlides,
  isLoadingPrompt,
  systemPrompt,
  templates,
}: CollateralPlanModalContentProps) {
  const buildInitialMessage = () => {
    const contextParts: string[] = [];

    if (customer) {
      contextParts.push(`Customer: ${customer.name}${customer.industry ? ` (${customer.industry})` : ""}`);
    } else {
      contextParts.push("No customer selected");
    }

    contextParts.push(`${skills.length} skills available`);

    if (gtmData) {
      if (gtmData.gongCalls.length > 0) {
        contextParts.push(`${gtmData.gongCalls.length} Gong calls`);
      }
      if (gtmData.hubspotActivities.length > 0) {
        contextParts.push(`${gtmData.hubspotActivities.length} HubSpot activities`);
      }
    }

    if (templates.length > 0) {
      contextParts.push(`${templates.length} templates available`);
    }

    return {
      role: "assistant",
      content: customer
        ? `I'm ready to help you plan collateral for **${customer.name}**.\n\n**Context I have:**\n- ${contextParts.join("\n- ")}\n\nWhat would you like to create? I can suggest battlecards, one-pagers, proposals, case studies, or custom content based on your needs.`
        : `I'm ready to help you plan sales collateral.\n\n**Context I have:**\n- ${contextParts.join("\n- ")}\n\nSelect a customer from the Focus Bar to get personalized recommendations, or tell me what type of collateral you'd like to create.`,
    };
  };

  const [messages, setMessages] = useState<Message[]>(() => {
    if (isLoadingPrompt) {
      return [] as Message[];
    }
    return [buildInitialMessage()] as Message[];
  });
  const [input, setInput] = useState("");
  const [approvedPlan, setApprovedPlan] = useState<CollateralPlan | null>(null);
  const [slideData, setSlideData] = useState<SlideData | null>(null);

  // Send message mutation
  type SendMessageInput = {
    message: string;
    conversationHistory: Message[];
    context: {
      customer?: {
        id: string;
        name: string;
        industry?: string;
        region?: string;
        tier?: string;
        content?: string;
        considerations?: string[];
      };
      skills: { id: string; title: string; contentPreview: string }[];
      gtm?: {
        gongCalls: { id: string; title: string; date: string; summary?: string }[];
        hubspotActivities: { id: string; type: string; date: string; subject: string }[];
      };
      templates: TemplateInfo[];
    };
  };

  type SendMessageResponse = {
    response: string;
    plan?: CollateralPlan;
    slideData?: SlideData;
  };

  const sendMutation = useApiMutation<SendMessageResponse, SendMessageInput>({
    url: "/api/collateral/plan",
    method: "POST",
    onSuccess: (data) => {
      // Add assistant response to messages
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

      // Check if plan was approved
      if (data.plan) {
        setApprovedPlan(data.plan);
        toast.success("Collateral plan created! You can now apply it.");
      }

      // Check if slide data was extracted
      if (data.slideData && Object.keys(data.slideData).length > 0) {
        setSlideData(data.slideData);
        toast.success(`Extracted ${Object.keys(data.slideData).length} fields for slides!`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSend = useCallback(() => {
    if (!input.trim() || sendMutation.isPending) return;

    // Add user message to conversation
    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = input.trim();
    setInput("");

    // Build context and send to API
    sendMutation.mutate({
      message: messageToSend,
      conversationHistory: messages,
      context: {
        customer: customer
          ? {
              id: customer.id,
              name: customer.name,
              industry: customer.industry || undefined,
              region: customer.region || undefined,
              tier: customer.tier || undefined,
              content: customer.content || undefined,
              considerations: customer.considerations || undefined,
            }
          : undefined,
        skills: skills.slice(0, 15).map((s) => ({
          id: s.id,
          title: s.title,
          contentPreview: s.content.slice(0, 200) + (s.content.length > 200 ? "..." : ""),
        })),
        gtm: gtmData
          ? {
              gongCalls: gtmData.gongCalls.slice(0, 5).map((c) => ({
                id: c.id,
                title: c.title,
                date: c.date,
                summary: c.summary,
              })),
              hubspotActivities: gtmData.hubspotActivities.slice(0, 10).map((a) => ({
                id: a.id,
                type: a.type,
                date: a.date,
                subject: a.subject,
              })),
            }
          : undefined,
        templates: templates,
      },
    });
  }, [input, sendMutation, messages, customer, skills, gtmData, templates]);

  const handleApplyPlan = () => {
    if (approvedPlan && onApplyPlan) {
      onApplyPlan(approvedPlan);
      toast.success("Plan applied! Check the Output section.");
      onClose();
    }
  };

  const handleFillSlides = () => {
    if (slideData && onFillSlides) {
      onFillSlides(slideData);
      onClose();
    }
  };

  return (
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          width: "90%",
          maxWidth: "800px",
          height: "80vh",
          maxHeight: "700px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fafafa",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                Plan Collateral
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                {customer ? `For ${customer.name}` : "AI-guided planning"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Conversational Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {isLoadingPrompt ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
              }}
            >
              <Loader2 className="animate-spin" size={24} style={{ marginRight: "8px" }} />
              Loading...
            </div>
          ) : (
            <ConversationalPanel
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              isLoading={sendMutation.isPending}
              loadingText="Planning..."
              placeholder="Describe what collateral you need..."
              systemPrompt={systemPrompt}
              systemPromptTitle="Collateral Planning Prompt"
            />
          )}
        </div>

        {/* Slide Data Preview */}
        {slideData && Object.keys(slideData).length > 0 && (
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #e2e8f0",
              backgroundColor: "#eff6ff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <Table2 size={20} color="#2563eb" />
              <span style={{ fontWeight: 600, color: "#2563eb" }}>
                Slide Data Ready ({Object.keys(slideData).length} fields)
              </span>
            </div>

            <div
              style={{
                maxHeight: "150px",
                overflowY: "auto",
                backgroundColor: "#fff",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                marginBottom: "16px",
              }}
            >
              <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                <tbody>
                  {Object.entries(slideData).slice(0, 10).map(([key, value], idx) => (
                    <tr
                      key={key}
                      style={{
                        borderBottom: idx < Math.min(Object.keys(slideData).length, 10) - 1 ? "1px solid #f1f5f9" : "none",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 12px",
                          fontWeight: 500,
                          color: "#475569",
                          width: "35%",
                          verticalAlign: "top",
                        }}
                      >
                        {key}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          color: "#1e293b",
                          wordBreak: "break-word",
                        }}
                      >
                        {value.length > 100 ? `${value.slice(0, 100)}...` : value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {Object.keys(slideData).length > 10 && (
                <div style={{ padding: "8px 12px", color: "#64748b", fontSize: "12px", textAlign: "center" }}>
                  ...and {Object.keys(slideData).length - 10} more fields
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setSlideData(null)}>
                Clear
              </Button>
              {onFillSlides && (
                <Button onClick={handleFillSlides} style={{ backgroundColor: "#2563eb" }}>
                  <Presentation size={16} style={{ marginRight: "6px" }} />
                  Fill Google Slides
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Plan Preview / Actions */}
        {approvedPlan && (
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #e2e8f0",
              backgroundColor: "#f0fdf4",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <CheckCircle size={20} color="#16a34a" />
              <span style={{ fontWeight: 600, color: "#16a34a" }}>
                Plan Ready ({approvedPlan.collateral.length} item{approvedPlan.collateral.length !== 1 ? "s" : ""})
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {approvedPlan.collateral.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <FileText size={16} color="#6366f1" />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 500 }}>{item.name}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      {item.type} | {item.template === "custom" ? "Custom" : item.template}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      backgroundColor:
                        item.priority === "high"
                          ? "#fef2f2"
                          : item.priority === "medium"
                          ? "#fefce8"
                          : "#f0fdf4",
                      color:
                        item.priority === "high"
                          ? "#dc2626"
                          : item.priority === "medium"
                          ? "#ca8a04"
                          : "#16a34a",
                    }}
                  >
                    {item.priority}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setApprovedPlan(null)}>
                Refine Plan
              </Button>
              <Button onClick={handleApplyPlan}>
                Apply Plan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
