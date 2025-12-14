"use client";

import {
  Users,
  RefreshCw,
  X,
  Loader2,
  CheckSquare,
  Square,
} from "lucide-react";
import UserSelector, { SelectableUser } from "@/components/UserSelector";
import { LibraryItem, TabType } from "../types";

interface BulkActionsBarProps {
  activeTab: TabType;
  filteredItems: LibraryItem[];
  selectedSkillIds: Set<string>;
  bulkActionMode: "none" | "assignOwner" | "refresh";
  bulkActionLoading: boolean;
  selectedCategory: string | null;
  searchQuery: string;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSetBulkActionMode: (mode: "none" | "assignOwner" | "refresh") => void;
  onBulkRefresh: () => void;
  onBulkAssignOwner: (user: SelectableUser) => void;
}

export default function BulkActionsBar({
  activeTab,
  filteredItems,
  selectedSkillIds,
  bulkActionMode,
  bulkActionLoading,
  selectedCategory,
  searchQuery,
  onSelectAll,
  onClearSelection,
  onSetBulkActionMode,
  onBulkRefresh,
  onBulkAssignOwner,
}: BulkActionsBarProps) {
  const skillCount = filteredItems.filter(i => i.type === "skills").length;
  const allSkillsSelected = selectedSkillIds.size === skillCount && selectedSkillIds.size > 0;

  if (activeTab !== "skills") {
    return (
      <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "16px" }}>
        Showing {filteredItems.length} {activeTab}
        {selectedCategory && ` in "${selectedCategory}"`}
        {searchQuery && ` matching "${searchQuery}"`}
      </p>
    );
  }

  return (
    <>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "16px",
        padding: selectedSkillIds.size > 0 ? "12px 16px" : "0",
        backgroundColor: selectedSkillIds.size > 0 ? "#f0f9ff" : "transparent",
        border: selectedSkillIds.size > 0 ? "1px solid #bae6fd" : "none",
        borderRadius: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Select all checkbox */}
          <button
            onClick={onSelectAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              backgroundColor: "transparent",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "#475569",
            }}
          >
            {allSkillsSelected ? (
              <CheckSquare size={16} style={{ color: "#0ea5e9" }} />
            ) : (
              <Square size={16} />
            )}
            {selectedSkillIds.size > 0 ? `${selectedSkillIds.size} selected` : "Select"}
          </button>

          {selectedSkillIds.size > 0 && (
            <>
              {/* Bulk assign owner */}
              <button
                onClick={() => onSetBulkActionMode("assignOwner")}
                disabled={bulkActionLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: "6px",
                  cursor: bulkActionLoading ? "not-allowed" : "pointer",
                  fontSize: "0.85rem",
                  color: "#166534",
                  fontWeight: 500,
                }}
              >
                <Users size={16} />
                Assign Owner
              </button>

              {/* Bulk refresh */}
              <button
                onClick={onBulkRefresh}
                disabled={bulkActionLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #93c5fd",
                  borderRadius: "6px",
                  cursor: bulkActionLoading ? "not-allowed" : "pointer",
                  fontSize: "0.85rem",
                  color: "#1d4ed8",
                  fontWeight: 500,
                }}
              >
                {bulkActionLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Refresh
              </button>

              {/* Clear selection */}
              <button
                onClick={onClearSelection}
                style={{
                  padding: "6px",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
                title="Clear selection"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>

        <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>
          Showing {filteredItems.length} {activeTab}
          {selectedCategory && ` in "${selectedCategory}"`}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Bulk assign owner modal */}
      {bulkActionMode === "assignOwner" && (
        <div style={{
          marginBottom: "16px",
          padding: "16px",
          backgroundColor: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
              Assign owner to {selectedSkillIds.size} skill(s)
            </h4>
            <button
              onClick={() => onSetBulkActionMode("none")}
              style={{
                padding: "4px",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
              }}
            >
              <X size={18} />
            </button>
          </div>
          <UserSelector
            onSelect={onBulkAssignOwner}
            onCancel={() => onSetBulkActionMode("none")}
            placeholder="Search team members..."
            disabled={bulkActionLoading}
          />
          {bulkActionLoading && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "12px",
              color: "#64748b",
              fontSize: "0.85rem",
            }}>
              <Loader2 size={16} className="animate-spin" />
              Assigning owner to skills...
            </div>
          )}
        </div>
      )}
    </>
  );
}
