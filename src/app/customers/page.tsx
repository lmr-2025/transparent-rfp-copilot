"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAllProfiles,
  updateProfile,
  deleteProfile,
} from "@/lib/customerProfileApi";
import { CustomerProfile } from "@/types/customerProfile";
import { InlineError } from "@/components/ui/status-display";
import CustomerDocuments from "./components/CustomerDocuments";

const styles = {
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "24px",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    backgroundColor: "#fff",
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  cardExpanded: {
    border: "1px solid #6366f1",
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginTop: "12px",
    marginBottom: "4px",
    fontSize: "13px",
    color: "#475569",
  },
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
  },
  textarea: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "vertical" as const,
    minHeight: "80px",
  },
  button: {
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    color: "#fff",
  },
  secondaryButton: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
  },
  dangerButton: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },
  industryBadge: {
    display: "inline-block",
    padding: "2px 8px",
    backgroundColor: "#f0fdf4",
    color: "#166534",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
  },
  statusBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
  },
  searchBar: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    alignItems: "center",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: "#64748b",
  },
};

export default function CustomerProfileLibraryPage() {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<CustomerProfile | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profiles
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await fetchAllProfiles();
      setProfiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  // Filter profiles
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.industry?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && p.isActive) ||
      (statusFilter === "inactive" && !p.isActive);
    return matchesSearch && matchesStatus;
  });

  // Toggle expand
  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingProfile(null);
    } else {
      setExpandedId(id);
      setEditingProfile(null);
    }
    setConfirmingDeleteId(null);
  };

  // Start editing
  const startEdit = (profile: CustomerProfile) => {
    setEditingProfile({ ...profile });
  };

  // Save edit
  const saveEdit = async () => {
    if (!editingProfile) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(editingProfile.id, {
        name: editingProfile.name,
        industry: editingProfile.industry,
        website: editingProfile.website,
        content: editingProfile.content,
        considerations: editingProfile.considerations,
        // Keep legacy fields in sync for backwards compatibility
        overview: editingProfile.content || editingProfile.overview,
        isActive: editingProfile.isActive,
      });
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setEditingProfile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // Delete profile
  const handleDelete = async (id: string) => {
    try {
      await deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setExpandedId(null);
      setConfirmingDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete profile");
    }
  };

  // Toggle active status
  const toggleActive = async (profile: CustomerProfile) => {
    try {
      const updated = await updateProfile(profile.id, {
        isActive: !profile.isActive,
      });
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
    }
  };

  // Update editing field
  const updateEditField = (field: keyof CustomerProfile, value: unknown) => {
    if (!editingProfile) return;
    setEditingProfile({ ...editingProfile, [field]: value });
  };

  // Consideration helpers
  const addConsideration = () => {
    if (!editingProfile) return;
    updateEditField("considerations", [...(editingProfile.considerations || []), ""]);
  };

  const updateConsideration = (idx: number, value: string) => {
    if (!editingProfile) return;
    const considerations = [...(editingProfile.considerations || [])];
    considerations[idx] = value;
    updateEditField("considerations", considerations);
  };

  const removeConsideration = (idx: number) => {
    if (!editingProfile) return;
    updateEditField(
      "considerations",
      (editingProfile.considerations || []).filter((_, i) => i !== idx)
    );
  };

  // Helper to get display content (prefer new content field, fall back to legacy)
  const getDisplayContent = (profile: CustomerProfile): string => {
    if (profile.content) return profile.content;
    // Build from legacy fields if content not set
    const parts = [];
    if (profile.overview) parts.push(`## Overview\n${profile.overview}`);
    if (profile.products) parts.push(`## Products & Services\n${profile.products}`);
    if (profile.challenges) parts.push(`## Challenges & Needs\n${profile.challenges}`);
    if (profile.keyFacts?.length > 0) {
      parts.push(`## Key Facts\n${profile.keyFacts.map(f => `- **${f.label}:** ${f.value}`).join("\n")}`);
    }
    return parts.join("\n\n");
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: "60px" }}>
          <p style={{ color: "#64748b" }}>Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={{ marginBottom: "8px" }}>
        The Rolodex{" "}
        <span style={{ fontWeight: 400, color: "#64748b" }}>(Library)</span>
      </h1>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Manage your customer profiles.{" "}
        <Link
          href="/customers"
          style={{ color: "#6366f1", textDecoration: "none" }}
        >
          Build New Profile →
        </Link>
      </p>

      {error && (
        <div style={{ marginBottom: "16px" }}>
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Search & Filter */}
      <div style={styles.searchBar}>
        <input
          style={{ ...styles.input, maxWidth: "300px" }}
          placeholder="Search by name or industry..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={{ ...styles.input, maxWidth: "150px" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
        >
          <option value="all">All Profiles</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        <span style={{ color: "#64748b", fontSize: "14px" }}>
          {filteredProfiles.length} profile{filteredProfiles.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Profiles List */}
      {filteredProfiles.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontSize: "18px", marginBottom: "8px" }}>No profiles found</p>
          <p>
            {profiles.length === 0 ? (
              <>
                Get started by{" "}
                <Link href="/customers" style={{ color: "#6366f1" }}>
                  building your first customer profile
                </Link>
                .
              </>
            ) : (
              "Try adjusting your search or filter."
            )}
          </p>
        </div>
      ) : (
        filteredProfiles.map((profile) => {
          const isExpanded = expandedId === profile.id;
          const isEditing = editingProfile?.id === profile.id;

          return (
            <div
              key={profile.id}
              style={{
                ...styles.card,
                ...(isExpanded ? styles.cardExpanded : {}),
              }}
            >
              {/* Header Row */}
              <div
                onClick={() => toggleExpand(profile.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ margin: 0 }}>{profile.name}</h3>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: profile.isActive ? "#dcfce7" : "#f1f5f9",
                        color: profile.isActive ? "#166534" : "#64748b",
                      }}
                    >
                      {profile.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div style={{ marginTop: "6px", display: "flex", gap: "8px", alignItems: "center" }}>
                    {profile.industry && (
                      <span style={styles.industryBadge}>{profile.industry}</span>
                    )}
                  </div>
                </div>
                <div style={{ color: "#94a3b8", fontSize: "12px", textAlign: "right" }}>
                  <div>Updated {new Date(profile.updatedAt).toLocaleDateString()}</div>
                  <div style={{ marginTop: "2px" }}>
                    {profile.sourceUrls.length} source{profile.sourceUrls.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div
                  style={{ marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditing ? (
                    /* Edit Mode */
                    <>
                      <label style={styles.label}>Company Name</label>
                      <input
                        style={styles.input}
                        value={editingProfile.name}
                        onChange={(e) => updateEditField("name", e.target.value)}
                      />

                      <div style={{ display: "flex", gap: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <label style={styles.label}>Industry</label>
                          <input
                            style={styles.input}
                            value={editingProfile.industry || ""}
                            onChange={(e) => updateEditField("industry", e.target.value)}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={styles.label}>Website</label>
                          <input
                            style={styles.input}
                            value={editingProfile.website || ""}
                            onChange={(e) => updateEditField("website", e.target.value)}
                          />
                        </div>
                      </div>

                      <label style={styles.label}>Profile Content</label>
                      <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#64748b" }}>
                        Use markdown formatting. Include sections like Overview, Products & Services, Challenges & Needs, Key Facts.
                      </p>
                      <textarea
                        style={{ ...styles.textarea, minHeight: "300px", fontFamily: "monospace", fontSize: "13px" }}
                        value={editingProfile.content || getDisplayContent(editingProfile)}
                        onChange={(e) => updateEditField("content", e.target.value)}
                      />

                      <label style={styles.label}>Considerations</label>
                      <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#64748b" }}>
                        Special notes or caveats to keep in mind when working with this customer.
                      </p>
                      {(editingProfile.considerations || []).map((consideration, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                          <input
                            style={{ ...styles.input, flex: 1 }}
                            value={consideration}
                            onChange={(e) => updateConsideration(idx, e.target.value)}
                            placeholder="Enter a consideration..."
                          />
                          <button
                            style={{ ...styles.button, ...styles.secondaryButton }}
                            onClick={() => removeConsideration(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        style={{ ...styles.button, ...styles.secondaryButton, marginTop: "4px" }}
                        onClick={addConsideration}
                      >
                        + Add Consideration
                      </button>

                      <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button
                          style={{ ...styles.button, ...styles.secondaryButton }}
                          onClick={() => setEditingProfile(null)}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                        <button
                          style={{ ...styles.button, ...styles.primaryButton }}
                          onClick={saveEdit}
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </>
                  ) : (
                    /* View Mode */
                    <>
                      {/* Salesforce Static Fields (read-only) */}
                      {profile.salesforceId && (
                        <div style={{
                          marginBottom: "16px",
                          padding: "12px",
                          backgroundColor: "#e0f2fe",
                          borderRadius: "6px",
                          border: "1px solid #7dd3fc"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                            <span style={{
                              backgroundColor: "#0284c7",
                              color: "#fff",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}>
                              Salesforce
                            </span>
                            <span style={{ color: "#0369a1", fontSize: "12px" }}>
                              Linked to Salesforce Account
                            </span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 16px" }}>
                            {profile.region && (
                              <div style={{ fontSize: "13px" }}>
                                <span style={{ color: "#64748b" }}>Region:</span>{" "}
                                <span style={{ color: "#0c4a6e" }}>{profile.region}</span>
                              </div>
                            )}
                            {profile.tier && (
                              <div style={{ fontSize: "13px" }}>
                                <span style={{ color: "#64748b" }}>Tier:</span>{" "}
                                <span style={{ color: "#0c4a6e" }}>{profile.tier}</span>
                              </div>
                            )}
                            {profile.accountType && (
                              <div style={{ fontSize: "13px" }}>
                                <span style={{ color: "#64748b" }}>Type:</span>{" "}
                                <span style={{ color: "#0c4a6e" }}>{profile.accountType}</span>
                              </div>
                            )}
                            {profile.billingLocation && (
                              <div style={{ fontSize: "13px" }}>
                                <span style={{ color: "#64748b" }}>Location:</span>{" "}
                                <span style={{ color: "#0c4a6e" }}>{profile.billingLocation}</span>
                              </div>
                            )}
                            {profile.employeeCount && (
                              <div style={{ fontSize: "13px" }}>
                                <span style={{ color: "#64748b" }}>Employees:</span>{" "}
                                <span style={{ color: "#0c4a6e" }}>{profile.employeeCount.toLocaleString()}</span>
                              </div>
                            )}
                            {profile.annualRevenue && (
                              <div style={{ fontSize: "13px" }}>
                                <span style={{ color: "#64748b" }}>Revenue:</span>{" "}
                                <span style={{ color: "#0c4a6e" }}>${(profile.annualRevenue / 1000000).toFixed(1)}M</span>
                              </div>
                            )}
                          </div>
                          {profile.lastSalesforceSync && (
                            <div style={{ marginTop: "8px", fontSize: "11px", color: "#64748b" }}>
                              Last synced: {new Date(profile.lastSalesforceSync).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ marginBottom: "12px" }}>
                        <div
                          style={{
                            whiteSpace: "pre-wrap",
                            fontSize: "14px",
                            lineHeight: "1.6",
                          }}
                          className="profile-content"
                        >
                          {getDisplayContent(profile)}
                        </div>
                      </div>

                      {profile.considerations && profile.considerations.length > 0 && (
                        <div style={{ marginBottom: "12px", marginTop: "16px", padding: "12px", backgroundColor: "#fffbeb", borderRadius: "6px", border: "1px solid #fde68a" }}>
                          <strong style={{ color: "#92400e", fontSize: "13px" }}>Considerations</strong>
                          <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                            {profile.considerations.map((c, idx) => (
                              <li key={idx} style={{ fontSize: "14px", color: "#78350f", marginBottom: "4px" }}>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {profile.sourceUrls.length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          <strong style={{ color: "#475569", fontSize: "13px" }}>Sources</strong>
                          <div style={{ marginTop: "4px" }}>
                            {profile.sourceUrls.map((source, idx) => (
                              <div key={idx} style={{ fontSize: "13px", color: "#6366f1" }}>
                                <a href={source.url} target="_blank" rel="noopener noreferrer">
                                  {source.url}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Customer Documents */}
                      <CustomerDocuments
                        customerId={profile.id}
                        customerName={profile.name}
                      />

                      {/* Actions */}
                      <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          style={{ ...styles.button, ...styles.primaryButton }}
                          onClick={() => startEdit(profile)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ ...styles.button, ...styles.secondaryButton }}
                          onClick={() => toggleActive(profile)}
                        >
                          {profile.isActive ? "Deactivate" : "Activate"}
                        </button>
                        {confirmingDeleteId === profile.id ? (
                          <>
                            <span style={{ color: "#b91c1c", fontSize: "13px", alignSelf: "center" }}>
                              Delete permanently?
                            </span>
                            <button
                              style={{ ...styles.button, ...styles.dangerButton }}
                              onClick={() => handleDelete(profile.id)}
                            >
                              Yes, Delete
                            </button>
                            <button
                              style={{ ...styles.button, ...styles.secondaryButton }}
                              onClick={() => setConfirmingDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            style={{ ...styles.button, ...styles.dangerButton }}
                            onClick={() => setConfirmingDeleteId(profile.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
