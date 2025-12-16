"use client";

import { useState } from "react";
import Link from "next/link";
import { CustomerProfile } from "@/types/customerProfile";

type CustomerProfileSelectorProps = {
  profiles: CustomerProfile[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  onCancel: () => void;
  saving: boolean;
};

export default function CustomerProfileSelector({
  profiles,
  selectedIds,
  onSave,
  onCancel,
  saving,
}: CustomerProfileSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  const toggle = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  if (profiles.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
        <p>No customer profiles available.</p>
        <Link href="/customers" style={{ color: "#2563eb" }}>
          Build your first profile
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "16px" }}>
        {profiles.map((profile) => (
          <div
            key={profile.id}
            onClick={() => toggle(profile.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              marginBottom: "8px",
              backgroundColor: selected.has(profile.id) ? "#eff6ff" : "#f8fafc",
              borderRadius: "8px",
              border: selected.has(profile.id) ? "1px solid #3b82f6" : "1px solid #e2e8f0",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(profile.id)}
              onChange={() => toggle(profile.id)}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{profile.name}</div>
              {profile.industry && (
                <span style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  backgroundColor: "#f0fdf4",
                  color: "#166534",
                  borderRadius: "4px",
                  fontSize: "11px",
                  marginTop: "4px",
                }}>
                  {profile.industry}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#fff",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(Array.from(selected))}
          disabled={saving}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: saving ? "#94a3b8" : "#3b82f6",
            color: "#fff",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
