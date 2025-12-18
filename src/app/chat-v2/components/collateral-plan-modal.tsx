"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, FileText, Sparkles, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationalPanel, type Message } from "@/components/ui/conversational-panel";
import { toast } from "sonner";
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
}

export function CollateralPlanModal({
  isOpen,
  onClose,
  customer,
  skills,
  gtmData,
  onApplyPlan,
}: CollateralPlanModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [approvedPlan, setApprovedPlan] = useState<CollateralPlan | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);

  // Fetch planning prompt and templates on mount
  const { data: planningData, isLoading: isLoadingPrompt } = useQuery({
    queryKey: ["collateral-plan-setup"],
    queryFn: async () => {
      const res = await fetch("/api/collateral/plan");
      if (!res.ok) throw new Error("Failed to fetch planning setup");
      const data = await res.json();
      return data.data;
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (planningData) {
      setSystemPrompt(planningData.systemPrompt || "");
      setTemplates(planningData.templates || []);
    }
  }, [planningData]);

  // Initialize conversation when modal opens
  useEffect(() => {
    if (isOpen && messages.length === 0 && !isLoadingPrompt) {
      // Build initial context description
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

      const initialMessage: Message = {
        role: "assistant",
        content: customer
          ? `I'm ready to help you plan collateral for **${customer.name}**.\n\n**Context I have:**\n- ${contextParts.join("\n- ")}\n\nWhat would you like to create? I can suggest battlecards, one-pagers, proposals, case studies, or custom content based on your needs.`
          : `I'm ready to help you plan sales collateral.\n\n**Context I have:**\n- ${contextParts.join("\n- ")}\n\nSelect a customer from the Focus Bar to get personalized recommendations, or tell me what type of collateral you'd like to create.`,
      };

      setMessages([initialMessage]);
    }
  }, [isOpen, messages.length, isLoadingPrompt, customer, skills, gtmData, templates]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput("");
      setApprovedPlan(null);
    }
  }, [isOpen]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/collateral/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send message");
      }

      const data = await res.json();
      return data.data;
    },
    onSuccess: (data) => {
      // Add assistant response to messages
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

      // Check if plan was approved
      if (data.plan) {
        setApprovedPlan(data.plan);
        toast.success("Collateral plan created! You can now apply it.");
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
    setInput("");

    // Send to API
    sendMutation.mutate(input.trim());
  }, [input, sendMutation]);

  const handleApplyPlan = () => {
    if (approvedPlan && onApplyPlan) {
      onApplyPlan(approvedPlan);
      toast.success("Plan applied! Check the Output section.");
      onClose();
    }
  };

  if (!isOpen) return null;

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
