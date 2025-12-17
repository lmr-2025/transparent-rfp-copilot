"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAllProfiles,
  updateProfile,
  deleteProfile,
} from "@/lib/customerProfileApi";
import { CustomerProfile, CustomerProfileKeyFact } from "@/types/customerProfile";
import { InlineError } from "@/components/ui/status-display";

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
        overview: editingProfile.overview,
        products: editingProfile.products,
        challenges: editingProfile.challenges,
        keyFacts: editingProfile.keyFacts,
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

  // Key facts helpers
  const addKeyFact = () => {
    if (!editingProfile) return;
    const newFact: CustomerProfileKeyFact = { label: "", value: "" };
    updateEditField("keyFacts", [...editingProfile.keyFacts, newFact]);
  };

  const updateKeyFact = (idx: number, field: "label" | "value", value: string) => {
    if (!editingProfile) return;
    const facts = [...editingProfile.keyFacts];
    facts[idx] = { ...facts[idx], [field]: value };
    updateEditField("keyFacts", facts);
  };

  const removeKeyFact = (idx: number) => {
    if (!editingProfile) return;
    updateEditField(
      "keyFacts",
      editingProfile.keyFacts.filter((_, i) => i !== idx)
    );
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

                      <label style={styles.label}>Overview</label>
                      <textarea
                        style={{ ...styles.textarea, minHeight: "120px" }}
                        value={editingProfile.overview}
                        onChange={(e) => updateEditField("overview", e.target.value)}
                      />

                      <label style={styles.label}>Products & Services</label>
                      <textarea
                        style={styles.textarea}
                        value={editingProfile.products || ""}
                        onChange={(e) => updateEditField("products", e.target.value)}
                      />

                      <label style={styles.label}>Challenges & Needs</label>
                      <textarea
                        style={styles.textarea}
                        value={editingProfile.challenges || ""}
                        onChange={(e) => updateEditField("challenges", e.target.value)}
                      />

                      <label style={styles.label}>Key Facts</label>
                      {editingProfile.keyFacts.map((fact, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                          <input
                            style={{ ...styles.input, width: "120px" }}
                            value={fact.label}
                            onChange={(e) => updateKeyFact(idx, "label", e.target.value)}
                            placeholder="Label"
                          />
                          <input
                            style={{ ...styles.input, flex: 1 }}
                            value={fact.value}
                            onChange={(e) => updateKeyFact(idx, "value", e.target.value)}
                            placeholder="Value"
                          />
                          <button
                            style={{ ...styles.button, ...styles.secondaryButton }}
                            onClick={() => removeKeyFact(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        style={{ ...styles.button, ...styles.secondaryButton, marginTop: "4px" }}
                        onClick={addKeyFact}
                      >
                        + Add Fact
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
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ color: "#475569", fontSize: "13px" }}>Overview</strong>
                        <p style={{ margin: "4px 0", whiteSpace: "pre-wrap", fontSize: "14px" }}>
                          {profile.overview}
                        </p>
                      </div>

                      {profile.products && (
                        <div style={{ marginBottom: "12px" }}>
                          <strong style={{ color: "#475569", fontSize: "13px" }}>Products & Services</strong>
                          <p style={{ margin: "4px 0", whiteSpace: "pre-wrap", fontSize: "14px" }}>
                            {profile.products}
                          </p>
                        </div>
                      )}

                      {profile.challenges && (
                        <div style={{ marginBottom: "12px" }}>
                          <strong style={{ color: "#475569", fontSize: "13px" }}>Challenges & Needs</strong>
                          <p style={{ margin: "4px 0", whiteSpace: "pre-wrap", fontSize: "14px" }}>
                            {profile.challenges}
                          </p>
                        </div>
                      )}

                      {profile.keyFacts.length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          <strong style={{ color: "#475569", fontSize: "13px" }}>Key Facts</strong>
                          <div style={{ marginTop: "4px" }}>
                            {profile.keyFacts.map((fact, idx) => (
                              <div key={idx} style={{ fontSize: "14px", marginBottom: "2px" }}>
                                <strong>{fact.label}:</strong> {fact.value}
                              </div>
                            ))}
                          </div>
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
