"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, AlertCircle } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { InlineError } from "@/components/ui/status-display";

import {
  SearchFilterBar,
  AuditEntryRow,
  PaginationControls,
  AuditEntityType,
  AuditAction,
  AuditLogEntry,
  Pagination,
} from "./components";

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityType, setSelectedEntityType] = useState<AuditEntityType | "">("");
  const [selectedAction, setSelectedAction] = useState<AuditAction | "">("");
  const [showFilters, setShowFilters] = useState(false);

  // Expanded entries
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchAuditLog = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      if (searchQuery) params.set("search", searchQuery);
      if (selectedEntityType) params.set("entityType", selectedEntityType);
      if (selectedAction) params.set("action", selectedAction);

      const response = await fetch(`/api/audit-log?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch audit log");
      }

      const result = await response.json();
      // Handle both { data: { entries, pagination } } and { entries, pagination } formats
      const data = result.data || result;
      setEntries(data.entries || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, selectedEntityType, selectedAction]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

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
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleEntityTypeChange = (value: AuditEntityType | "") => {
    setSelectedEntityType(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleActionChange = (value: AuditAction | "") => {
    setSelectedAction(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
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
          <InlineError message={error} onDismiss={() => setError(null)} />
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
