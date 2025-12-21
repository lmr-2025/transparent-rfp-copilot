"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileText,
  AlertTriangle,
  Edit3,
  Plus,
  Star,
} from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { useApiQuery } from "@/hooks/use-api";

type ContractWithFeedback = {
  id: string;
  name: string;
  customerName?: string;
  status: string;
  createdAt: string;
  analyzedAt?: string;
  feedbackStats: {
    totalFindings: number;
    manuallyAdded: number;
    responsesEdited: number;
    ratingsChanged: number;
    rationalesChanged: number;
  };
};

type ContractFeedbackItem = {
  id: string;
  category: string;
  clauseText: string;
  feedbackType: "ai_missed" | "response_edited" | "rating_changed" | "rationale_changed";
  original?: string;
  corrected?: string;
  context?: string;
};

type ContractFeedbackResponse = {
  contractId: string;
  contractName: string;
  customerName?: string;
  stats: {
    totalFindings: number;
    aiGenerated: number;
    manuallyAdded: number;
    responsesEdited: number;
    ratingsChanged: number;
    rationalesChanged: number;
  };
  feedback: ContractFeedbackItem[];
};

const feedbackTypeLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  ai_missed: { label: "AI Missed", color: "#dc2626", bgColor: "#fef2f2" },
  response_edited: { label: "Response Edited", color: "#2563eb", bgColor: "#eff6ff" },
  rating_changed: { label: "Rating Changed", color: "#d97706", bgColor: "#fef3c7" },
  rationale_changed: { label: "Rationale Changed", color: "#7c3aed", bgColor: "#f5f3ff" },
};

export default function ContractsTab() {
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);

  // Fetch contracts list
  const {
    data: contractsData,
    isLoading: contractsLoading,
    error: contractsError,
    refetch: refetchContracts,
  } = useApiQuery<{ contracts: ContractWithFeedback[] }>({
    queryKey: ["contracts-with-feedback"],
    url: "/api/contracts",
    params: { includeFeedbackStats: true },
  });

  const contracts = contractsData?.contracts || [];

  // Fetch expanded contract's feedback
  const {
    data: feedbackData,
    isLoading: feedbackLoading,
  } = useApiQuery<ContractFeedbackResponse>({
    queryKey: ["contract-feedback", expandedContractId],
    url: `/api/contracts/${expandedContractId}/feedback`,
    enabled: !!expandedContractId,
  });

  // Calculate totals
  const totals = contracts.reduce(
    (acc, c) => ({
      totalFindings: acc.totalFindings + (c.feedbackStats?.totalFindings || 0),
      manuallyAdded: acc.manuallyAdded + (c.feedbackStats?.manuallyAdded || 0),
      responsesEdited: acc.responsesEdited + (c.feedbackStats?.responsesEdited || 0),
      ratingsChanged: acc.ratingsChanged + (c.feedbackStats?.ratingsChanged || 0),
      rationalesChanged: acc.rationalesChanged + (c.feedbackStats?.rationalesChanged || 0),
    }),
    { totalFindings: 0, manuallyAdded: 0, responsesEdited: 0, ratingsChanged: 0, rationalesChanged: 0 }
  );

  const contractsWithFeedback = contracts.filter(
    (c) =>
      c.feedbackStats &&
      (c.feedbackStats.manuallyAdded > 0 ||
        c.feedbackStats.responsesEdited > 0 ||
        c.feedbackStats.ratingsChanged > 0 ||
        c.feedbackStats.rationalesChanged > 0)
  );

  return (
    <>
      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>{totals.totalFindings}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Total Findings</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #fecaca", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626" }}>{totals.manuallyAdded}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>AI Missed</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #bfdbfe", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2563eb" }}>{totals.responsesEdited}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Responses Edited</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #fde68a", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d97706" }}>{totals.ratingsChanged}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Ratings Changed</div>
        </div>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #ddd6fe", padding: "16px" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#7c3aed" }}>{totals.rationalesChanged}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Rationales Changed</div>
        </div>
      </div>

      {/* Refresh button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button
          onClick={() => refetchContracts()}
          disabled={contractsLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            background: "#0ea5e9",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          <RefreshCw size={14} className={contractsLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {contractsLoading && (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          <InlineLoader size="lg" className="text-sky-500" />
          <p style={{ marginTop: "12px" }}>Loading contract feedback...</p>
        </div>
      )}

      {/* Error */}
      {contractsError && (
        <div style={{ padding: "16px", background: "#fef2f2", color: "#dc2626", borderRadius: "8px", marginBottom: "16px" }}>
          {contractsError.message || "Failed to load contracts"}
        </div>
      )}

      {/* Empty state */}
      {!contractsLoading && contractsWithFeedback.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
          <FileText size={48} style={{ margin: "0 auto 12px", color: "#94a3b8" }} />
          <p style={{ color: "#64748b", marginBottom: "4px", fontWeight: 500 }}>No feedback yet</p>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
            Review contract findings and make corrections to generate feedback data.
          </p>
        </div>
      )}

      {/* Contracts with feedback */}
      {contractsWithFeedback.length > 0 && (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          {contractsWithFeedback.map((contract, index) => {
            const isExpanded = expandedContractId === contract.id;
            const stats = contract.feedbackStats;
            const totalFeedback =
              (stats?.manuallyAdded || 0) +
              (stats?.responsesEdited || 0) +
              (stats?.ratingsChanged || 0) +
              (stats?.rationalesChanged || 0);

            return (
              <div key={contract.id} style={{ borderBottom: index < contractsWithFeedback.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <button
                  onClick={() => setExpandedContractId(isExpanded ? null : contract.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "16px",
                    textAlign: "left",
                    background: isExpanded ? "#f8fafc" : "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  ) : (
                    <ChevronRight size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  )}
                  <FileText size={18} style={{ color: "#64748b", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "#1e293b" }}>{contract.name}</div>
                    {contract.customerName && (
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{contract.customerName}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    {stats?.manuallyAdded > 0 && (
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", background: "#fef2f2", color: "#dc2626" }}>
                        <Plus size={10} style={{ display: "inline", marginRight: "2px" }} />
                        {stats.manuallyAdded} missed
                      </span>
                    )}
                    {stats?.responsesEdited > 0 && (
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", background: "#eff6ff", color: "#2563eb" }}>
                        <Edit3 size={10} style={{ display: "inline", marginRight: "2px" }} />
                        {stats.responsesEdited} edited
                      </span>
                    )}
                    {(stats?.ratingsChanged || 0) + (stats?.rationalesChanged || 0) > 0 && (
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", background: "#fef3c7", color: "#d97706" }}>
                        <Star size={10} style={{ display: "inline", marginRight: "2px" }} />
                        {(stats?.ratingsChanged || 0) + (stats?.rationalesChanged || 0)} changed
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {totalFeedback} feedback item{totalFeedback !== 1 ? "s" : ""}
                  </span>
                </button>

                {isExpanded && (
                  <div style={{ padding: "0 16px 16px 48px", background: "#f8fafc" }}>
                    {feedbackLoading ? (
                      <div style={{ padding: "24px", textAlign: "center" }}>
                        <InlineLoader size="sm" />
                      </div>
                    ) : feedbackData?.feedback && feedbackData.feedback.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {feedbackData.feedback.map((item) => {
                          const typeConfig = feedbackTypeLabels[item.feedbackType];
                          return (
                            <div
                              key={item.id}
                              style={{
                                background: "white",
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                padding: "12px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    background: typeConfig.bgColor,
                                    color: typeConfig.color,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {typeConfig.label}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{item.category}</span>
                              </div>
                              <div style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "8px" }}>
                                {item.clauseText}
                              </div>
                              {item.original && (
                                <div style={{ fontSize: "0.8rem", marginBottom: "4px" }}>
                                  <span style={{ color: "#dc2626", fontWeight: 500 }}>Original:</span>{" "}
                                  <span style={{ color: "#64748b" }}>{item.original}</span>
                                </div>
                              )}
                              {item.corrected && (
                                <div style={{ fontSize: "0.8rem" }}>
                                  <span style={{ color: "#16a34a", fontWeight: 500 }}>Corrected:</span>{" "}
                                  <span style={{ color: "#1e293b" }}>{item.corrected}</span>
                                </div>
                              )}
                              {item.context && (
                                <div style={{ fontSize: "0.8rem", marginTop: "4px", color: "#64748b", fontStyle: "italic" }}>
                                  {item.context}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                        No feedback details available
                      </div>
                    )}

                    <div style={{ marginTop: "12px" }}>
                      <Link
                        href={`/contracts/${contract.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.875rem",
                          color: "#0ea5e9",
                          textDecoration: "none",
                        }}
                      >
                        View Contract →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
