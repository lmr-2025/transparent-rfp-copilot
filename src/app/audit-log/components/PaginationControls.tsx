"use client";

import { Pagination } from "./types";

type PaginationControlsProps = {
  pagination: Pagination;
  onPageChange: (page: number) => void;
};

export default function PaginationControls({
  pagination,
  onPageChange,
}: PaginationControlsProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "20px",
        padding: "12px 16px",
        backgroundColor: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
      }}
    >
      <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
        Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page === 1}
          style={{
            padding: "8px 16px",
            backgroundColor: pagination.page === 1 ? "#f1f5f9" : "#0ea5e9",
            color: pagination.page === 1 ? "#94a3b8" : "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: pagination.page === 1 ? "not-allowed" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page === pagination.totalPages}
          style={{
            padding: "8px 16px",
            backgroundColor: pagination.page === pagination.totalPages ? "#f1f5f9" : "#0ea5e9",
            color: pagination.page === pagination.totalPages ? "#94a3b8" : "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: pagination.page === pagination.totalPages ? "not-allowed" : "pointer",
            fontSize: "0.9rem",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
