"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ContractReviewSummary } from "@/types/contractReview";
import { parseApiData } from "@/lib/apiClient";
import { InlineError } from "@/components/ui/status-display";

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
    alignItems: "center",
    marginBottom: "24px",
    flexWrap: "wrap" as const,
    gap: "16px",
  },
  filters: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap" as const,
  },
  select: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    backgroundColor: "#fff",
  },
  searchInput: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    minWidth: "200px",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "12px",
    backgroundColor: "#fff",
    cursor: "pointer",
    transition: "all 0.2s",
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
    textDecoration: "none",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: "#64748b",
  },
};

const ratingColors: Record<string, { bg: string; text: string; label: string }> = {
  compliant: { bg: "#dcfce7", text: "#166534", label: "Compliant" },
  mostly_compliant: { bg: "#fef9c3", text: "#854d0e", label: "Mostly Compliant" },
  needs_review: { bg: "#fed7aa", text: "#9a3412", label: "Needs Review" },
  high_risk: { bg: "#fee2e2", text: "#b91c1c", label: "High Risk" },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "#f1f5f9", text: "#475569" },
  ANALYZING: { bg: "#e0f2fe", text: "#0369a1" },
  ANALYZED: { bg: "#dbeafe", text: "#1d4ed8" },
  REVIEWED: { bg: "#dcfce7", text: "#166534" },
  ARCHIVED: { bg: "#f3f4f6", text: "#6b7280" },
};

export default function ContractLibraryPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await fetch("/api/contracts");
      if (!response.ok) throw new Error("Failed to fetch contracts");
      const json = await response.json();
      const contracts = parseApiData<ContractReviewSummary[]>(json, "contracts");
      setContracts(Array.isArray(contracts) ? contracts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      setContracts(contracts.filter((c) => c.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const filteredContracts = contracts.filter((c) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !c.name.toLowerCase().includes(searchLower) &&
        !c.customerName?.toLowerCase().includes(searchLower) &&
        !c.contractType?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (ratingFilter !== "all" && c.overallRating !== ratingFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div style={styles.container}>
        <LoadingSpinner title="Loading contracts..." />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: "0 0 4px 0" }}>
            The Clause Checker{" "}
            <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>
              Library
            </span>
          </h1>
          <p style={{ margin: 0, color: "#64748b" }}>
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""} reviewed
          </p>
        </div>
        <Link
          href="/contracts"
          style={{
            ...styles.button,
            backgroundColor: "#3b82f6",
            color: "#fff",
          }}
        >
          Upload New Contract
        </Link>
      </div>

      {error && (
        <div style={{ marginBottom: "16px" }}>
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {contracts.length > 0 && (
        <div style={styles.filters}>
          <input
            type="text"
            placeholder="Search by name, customer, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ANALYZING">Analyzing</option>
            <option value="ANALYZED">Analyzed</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Ratings</option>
            <option value="compliant">Compliant</option>
            <option value="mostly_compliant">Mostly Compliant</option>
            <option value="needs_review">Needs Review</option>
            <option value="high_risk">High Risk</option>
          </select>
        </div>
      )}

      {filteredContracts.length === 0 ? (
        <div style={styles.emptyState}>
          {contracts.length === 0 ? (
            <>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
              <h3 style={{ margin: "0 0 8px 0", color: "#374151" }}>No contracts yet</h3>
              <p style={{ margin: "0 0 20px 0" }}>
                Upload your first contract to start analyzing security clauses.
              </p>
              <Link
                href="/contracts"
                style={{
                  ...styles.button,
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  display: "inline-block",
                }}
              >
                Upload Contract
              </Link>
            </>
          ) : (
            <p>No contracts match your filters.</p>
          )}
        </div>
      ) : (
        filteredContracts.map((contract) => {
          const rating = ratingColors[contract.overallRating || "needs_review"];
          const status = statusColors[contract.status] || statusColors.PENDING;

          return (
            <div
              key={contract.id}
              style={styles.card}
              onClick={() => router.push(`/contracts/${contract.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 6px 0", color: "#1f2937" }}>{contract.name}</h3>
                  <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "10px" }}>
                    {contract.customerName && <span>{contract.customerName} • </span>}
                    {contract.contractType && <span>{contract.contractType} • </span>}
                    <span>{new Date(contract.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {contract.overallRating && (
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: rating.bg,
                          color: rating.text,
                        }}
                      >
                        {rating.label}
                      </span>
                    )}
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: status.bg,
                        color: status.text,
                      }}
                    >
                      {contract.status}
                    </span>
                    {contract.findingsCount !== undefined && contract.findingsCount > 0 && (
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {contract.findingsCount} findings
                      </span>
                    )}
                    {contract.riskCount !== undefined && contract.riskCount > 0 && (
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: "#fee2e2",
                          color: "#b91c1c",
                        }}
                      >
                        {contract.riskCount} risks
                      </span>
                    )}
                    {contract.gapCount !== undefined && contract.gapCount > 0 && (
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: "#fed7aa",
                          color: "#9a3412",
                        }}
                      >
                        {contract.gapCount} gaps
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {deleteConfirm === contract.id ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(contract.id);
                        }}
                        style={{
                          ...styles.button,
                          padding: "6px 12px",
                          backgroundColor: "#dc2626",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(null);
                        }}
                        style={{
                          ...styles.button,
                          padding: "6px 12px",
                          backgroundColor: "#f1f5f9",
                          color: "#475569",
                          fontSize: "12px",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(contract.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "16px",
                        padding: "4px 8px",
                        color: "#94a3b8",
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
