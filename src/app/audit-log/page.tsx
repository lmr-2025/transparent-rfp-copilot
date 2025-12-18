"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";
import { useApiQuery } from "@/hooks/use-api";

import {
  SearchFilterBar,
  AuditEntryRow,
  PaginationControls,
  AuditEntityType,
  AuditAction,
  AuditLogEntry,
  Pagination,
} from "./components";

type AuditLogResponse = {
  entries: AuditLogEntry[];
  pagination: Pagination;
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState<AuditEntityType | "">("");
  const [selectedAction, setSelectedAction] = useState<AuditAction | "">("");
  const [showFilters, setShowFilters] = useState(false);

  // Expanded entries
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch audit log with useApiQuery
  const {
    data: auditData,
    isLoading,
    error: queryError,
    refetch: fetchAuditLog,
  } = useApiQuery<AuditLogResponse>({
    queryKey: ["audit-log", page, limit, searchQuery, selectedEntityType, selectedAction],
    url: "/api/audit-log",
    params: {
      page,
      limit,
      search: searchQuery || undefined,
      entityType: selectedEntityType || undefined,
      action: selectedAction || undefined,
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  const entries = auditData?.entries || [];
  const pagination = auditData?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };
  const error = queryError?.message || null;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedEntityType("");
    setSelectedAction("");
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleEntityTypeChange = (value: AuditEntityType | "") => {
    setSelectedEntityType(value);
    setPage(1);
  };

  const handleActionChange = (value: AuditAction | "") => {
    setSelectedAction(value);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const hasActiveFilters = searchQuery || selectedEntityType || selectedAction;

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "#1e293b",
            marginBottom: "8px",
          }}
        >
          Audit Log
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
          Track all changes across skills, customers, projects, and more
        </p>
      </div>

      {/* Search and Filters */}
      <SearchFilterBar
        searchQuery={searchQuery}
        selectedEntityType={selectedEntityType}
        selectedAction={selectedAction}
        showFilters={showFilters}
        isLoading={isLoading}
        hasActiveFilters={!!hasActiveFilters}
        onSearchChange={handleSearchChange}
        onEntityTypeChange={handleEntityTypeChange}
        onActionChange={handleActionChange}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onClearFilters={clearFilters}
        onRefresh={fetchAuditLog}
      />

      {/* Error State */}
      {error && (
        <div style={{ marginBottom: "20px" }}>
          <InlineError message={error} />
        </div>
      )}

      {/* Loading State */}
      {isLoading && entries.length === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
            color: "#64748b",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <InlineLoader size="lg" className="text-sky-500" />
          </div>
          <p>Loading audit log...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && entries.length === 0 && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            backgroundColor: "#f8fafc",
            borderRadius: "12px",
            border: "1px dashed #e2e8f0",
          }}
        >
          <Clock size={48} style={{ color: "#94a3b8", marginBottom: "16px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#475569", marginBottom: "8px" }}>
            No audit log entries yet
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            {hasActiveFilters
              ? "No entries match your filters. Try adjusting your search criteria."
              : "Changes to skills, customers, and other items will appear here."}
          </p>
        </div>
      )}

      {/* Audit Log Entries */}
      {entries.length > 0 && (
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {entries.map((entry, index) => (
            <AuditEntryRow
              key={entry.id}
              entry={entry}
              isExpanded={expandedIds.has(entry.id)}
              isLast={index === entries.length - 1}
              onToggle={() => toggleExpanded(entry.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <PaginationControls
        pagination={pagination}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
