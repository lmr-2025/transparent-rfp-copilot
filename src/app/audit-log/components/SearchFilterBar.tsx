"use client";

import { Search, Filter, RefreshCw, X } from "lucide-react";
import { AuditEntityType, AuditAction, entityTypeConfig, actionConfig } from "./types";

type SearchFilterBarProps = {
  searchQuery: string;
  selectedEntityType: AuditEntityType | "";
  selectedAction: AuditAction | "";
  showFilters: boolean;
  isLoading: boolean;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onEntityTypeChange: (value: AuditEntityType | "") => void;
  onActionChange: (value: AuditAction | "") => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
  onRefresh: () => void;
};

export default function SearchFilterBar({
  searchQuery,
  selectedEntityType,
  selectedAction,
  showFilters,
  isLoading,
  hasActiveFilters,
  onSearchChange,
  onEntityTypeChange,
  onActionChange,
  onToggleFilters,
  onClearFilters,
  onRefresh,
}: SearchFilterBarProps) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
            minWidth: "200px",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "8px 12px",
          }}
        >
          <Search size={18} style={{ color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search by entity name, user..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
              fontSize: "0.9rem",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              style={{
                padding: "2px",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={onToggleFilters}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            backgroundColor: showFilters ? "#0ea5e9" : "#f8fafc",
            border: `1px solid ${showFilters ? "#0ea5e9" : "#e2e8f0"}`,
            borderRadius: "8px",
            color: showFilters ? "#fff" : "#475569",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          <Filter size={16} />
          Filters
          {hasActiveFilters && (
            <span
              style={{
                backgroundColor: showFilters ? "#fff" : "#0ea5e9",
                color: showFilters ? "#0ea5e9" : "#fff",
                borderRadius: "50%",
                width: "18px",
                height: "18px",
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              !
            </span>
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            color: "#475569",
            cursor: isLoading ? "not-allowed" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid #e2e8f0",
            flexWrap: "wrap",
          }}
        >
          {/* Entity Type */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "#64748b",
                marginBottom: "4px",
              }}
            >
              Entity Type
            </label>
            <select
              value={selectedEntityType}
              onChange={(e) => onEntityTypeChange(e.target.value as AuditEntityType | "")}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                fontSize: "0.9rem",
                minWidth: "150px",
              }}
            >
              <option value="">All Types</option>
              {Object.entries(entityTypeConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "#64748b",
                marginBottom: "4px",
              }}
            >
              Action
            </label>
            <select
              value={selectedAction}
              onChange={(e) => onActionChange(e.target.value as AuditAction | "")}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                fontSize: "0.9rem",
                minWidth: "150px",
              }}
            >
              <option value="">All Actions</option>
              {Object.entries(actionConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              style={{
                padding: "8px 14px",
                backgroundColor: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "0.9rem",
                alignSelf: "flex-end",
              }}
            >
              Clear All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
