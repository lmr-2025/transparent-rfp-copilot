"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ContractReview, ContractFinding, AlignmentRating, FindingCategory } from "@/types/contractReview";

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap" as const,
    gap: "16px",
  },
  backLink: {
    color: "#3b82f6",
    textDecoration: "none",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginBottom: "12px",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  badge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
  },
  button: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "14px",
  },
  finding: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "12px",
    backgroundColor: "#fff",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    resize: "vertical" as const,
    minHeight: "100px",
  },
};

const ratingColors: Record<string, { bg: string; text: string; label: string }> = {
  compliant: { bg: "#dcfce7", text: "#166534", label: "Compliant" },
  mostly_compliant: { bg: "#fef9c3", text: "#854d0e", label: "Mostly Compliant" },
  needs_review: { bg: "#fed7aa", text: "#9a3412", label: "Needs Review" },
  high_risk: { bg: "#fee2e2", text: "#b91c1c", label: "High Risk" },
};

const alignmentColors: Record<AlignmentRating, { bg: string; text: string; label: string }> = {
  can_comply: { bg: "#dcfce7", text: "#166534", label: "Can Comply" },
  partial: { bg: "#fef9c3", text: "#854d0e", label: "Partial" },
  gap: { bg: "#fed7aa", text: "#9a3412", label: "Gap" },
  risk: { bg: "#fee2e2", text: "#b91c1c", label: "Risk" },
  info_only: { bg: "#e0f2fe", text: "#0369a1", label: "Info Only" },
};

const categoryLabels: Record<FindingCategory, string> = {
  data_protection: "Data Protection",
  security_controls: "Security Controls",
  certifications: "Certifications",
  incident_response: "Incident Response",
  audit_rights: "Audit Rights",
  subprocessors: "Subprocessors",
  data_retention: "Data Retention",
  insurance: "Insurance",
  liability: "Liability",
  confidentiality: "Confidentiality",
  other: "Other",
};

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [contract, setContract] = useState<ContractReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterRating, setFilterRating] = useState<AlignmentRating | "all">("all");
  const [filterCategory, setFilterCategory] = useState<FindingCategory | "all">("all");

  const fetchContract = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Contract not found");
        }
        throw new Error("Failed to fetch contract");
      }
      const json = await response.json();
      const data = json.data ?? json;
      setContract(data);
      setNotes(data.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contract");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const handleSaveNotes = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) throw new Error("Failed to save notes");
      const updated = await response.json();
      setContract(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REVIEWED",
          notes,
        }),
      });
      if (!response.ok) throw new Error("Failed to mark as reviewed");
      const updated = await response.json();
      setContract(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFlag = async (findingId: string) => {
    if (!contract || !contract.findings) return;

    const updatedFindings = contract.findings.map((f: ContractFinding) =>
      f.id === findingId ? { ...f, flagged: !f.flagged } : f
    );

    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings: updatedFindings }),
      });
      if (!response.ok) throw new Error("Failed to update finding");
      const updated = await response.json();
      setContract(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <LoadingSpinner title="Loading contract..." />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div style={styles.container}>
        <Link href="/contracts/library" style={styles.backLink}>
          ← Back to Library
        </Link>
        <div style={{ ...styles.card, backgroundColor: "#fee2e2", borderColor: "#fecaca" }}>
          <p style={{ color: "#b91c1c", margin: 0 }}>{error || "Contract not found"}</p>
        </div>
      </div>
    );
  }

  const findings: ContractFinding[] = contract.findings || [];
  const filteredFindings = findings.filter((f) => {
    if (filterRating !== "all" && f.rating !== filterRating) return false;
    if (filterCategory !== "all" && f.category !== filterCategory) return false;
    return true;
  });

  const ratingStyle = ratingColors[contract.overallRating || "needs_review"];
  const riskCount = findings.filter((f) => f.rating === "risk").length;
  const gapCount = findings.filter((f) => f.rating === "gap").length;
  const flaggedCount = findings.filter((f) => f.flagged).length;

  return (
    <div style={styles.container}>
      <Link href="/contracts/library" style={styles.backLink}>
        ← Back to Library
      </Link>

      <div style={styles.header}>
        <div>
          <h1 style={{ margin: "0 0 8px 0" }}>{contract.name}</h1>
          <div style={{ color: "#64748b", fontSize: "14px" }}>
            {contract.customerName && <span>{contract.customerName} • </span>}
            {contract.contractType && <span>{contract.contractType} • </span>}
            <span>Uploaded {new Date(contract.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span
            style={{
              ...styles.badge,
              backgroundColor: ratingStyle.bg,
              color: ratingStyle.text,
            }}
          >
            {ratingStyle.label}
          </span>
          <span
            style={{
              ...styles.badge,
              backgroundColor: contract.status === "REVIEWED" ? "#dcfce7" : "#e0f2fe",
              color: contract.status === "REVIEWED" ? "#166534" : "#0369a1",
            }}
          >
            {contract.status}
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ ...styles.card, flex: "1", minWidth: "150px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#1f2937" }}>{findings.length}</div>
          <div style={{ color: "#64748b", fontSize: "13px" }}>Total Findings</div>
        </div>
        <div style={{ ...styles.card, flex: "1", minWidth: "150px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#b91c1c" }}>{riskCount}</div>
          <div style={{ color: "#64748b", fontSize: "13px" }}>Risks</div>
        </div>
        <div style={{ ...styles.card, flex: "1", minWidth: "150px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#9a3412" }}>{gapCount}</div>
          <div style={{ color: "#64748b", fontSize: "13px" }}>Gaps</div>
        </div>
        <div style={{ ...styles.card, flex: "1", minWidth: "150px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#7c3aed" }}>{flaggedCount}</div>
          <div style={{ color: "#64748b", fontSize: "13px" }}>Flagged</div>
        </div>
      </div>

      {/* Executive Summary */}
      {contract.summary && (
        <div style={styles.card}>
          <h3 style={{ margin: "0 0 12px 0", color: "#374151" }}>Executive Summary</h3>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {contract.summary}
          </p>
        </div>
      )}

      {/* Findings */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, color: "#374151" }}>
            Findings ({filteredFindings.length})
          </h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value as AlignmentRating | "all")}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "13px",
              }}
            >
              <option value="all">All Ratings</option>
              {Object.entries(alignmentColors).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as FindingCategory | "all")}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "13px",
              }}
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>
            No findings match the current filters.
          </p>
        ) : (
          filteredFindings.map((finding) => {
            const alignment = alignmentColors[finding.rating];
            return (
              <div
                key={finding.id}
                style={{
                  ...styles.finding,
                  borderLeft: `4px solid ${alignment.text}`,
                  backgroundColor: finding.flagged ? "#fefce8" : "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: alignment.bg,
                        color: alignment.text,
                      }}
                    >
                      {alignment.label}
                    </span>
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                      }}
                    >
                      {categoryLabels[finding.category]}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleFlag(finding.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "18px",
                      padding: "4px",
                    }}
                    title={finding.flagged ? "Remove flag" : "Flag for review"}
                  >
                    {finding.flagged ? "🚩" : "⚐"}
                  </button>
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>
                    Clause:
                  </div>
                  <div style={{
                    backgroundColor: "#f8fafc",
                    padding: "10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#334155",
                    fontStyle: "italic",
                  }}>
                    &ldquo;{finding.clauseText}&rdquo;
                  </div>
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>
                    Analysis:
                  </div>
                  <div style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.5 }}>
                    {finding.rationale}
                  </div>
                </div>

                {finding.suggestedResponse && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>
                      Suggested Response:
                    </div>
                    <div style={{
                      backgroundColor: "#eff6ff",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      color: "#1e40af",
                      lineHeight: 1.5,
                    }}>
                      {finding.suggestedResponse}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Notes */}
      <div style={styles.card}>
        <h3 style={{ margin: "0 0 12px 0", color: "#374151" }}>Review Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this contract review..."
          style={styles.textarea}
        />
        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
          <button
            onClick={handleSaveNotes}
            disabled={saving}
            style={{
              ...styles.button,
              backgroundColor: saving ? "#d1d5db" : "#3b82f6",
              color: "#fff",
            }}
          >
            {saving ? "Saving..." : "Save Notes"}
          </button>
          {contract.status !== "REVIEWED" && (
            <button
              onClick={handleMarkReviewed}
              disabled={saving}
              style={{
                ...styles.button,
                backgroundColor: saving ? "#d1d5db" : "#22c55e",
                color: "#fff",
              }}
            >
              Mark as Reviewed
            </button>
          )}
        </div>
        {contract.reviewedAt && (
          <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748b" }}>
            Reviewed on {new Date(contract.reviewedAt).toLocaleDateString()}
            {contract.reviewedBy && ` by ${contract.reviewedBy}`}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <button
          onClick={() => router.push("/contracts")}
          style={{
            ...styles.button,
            backgroundColor: "#f1f5f9",
            color: "#475569",
          }}
        >
          Upload New Contract
        </button>
      </div>
    </div>
  );
}
