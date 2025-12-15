"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useConfirm } from "@/components/ConfirmModal";
import Link from "next/link";
import SnippetPicker from "@/components/SnippetPicker";

type InstructionPreset = {
  id: string;
  name: string;
  content: string;
  description: string | null;
  isShared: boolean;
  isDefault: boolean;
  shareStatus: "PRIVATE" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  shareRequestedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByEmail: string | null;
};

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    backgroundColor: "#fff",
  },
  button: {
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "13px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 500,
  },
};

const statusColors = {
  PRIVATE: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" },
  PENDING_APPROVAL: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  APPROVED: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  REJECTED: { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" },
};

export default function InstructionPresetsAdminPage() {
  const { data: session, status } = useSession();
  const [presets, setPresets] = useState<InstructionPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const { confirm: confirmDelete, ConfirmDialog } = useConfirm({
    title: "Delete Preset",
    message: "Are you sure you want to delete this preset?",
    confirmLabel: "Delete",
    variant: "danger",
  });

  // Edit modal state
  const [editingPreset, setEditingPreset] = useState<InstructionPreset | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const createTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper to insert snippet at cursor position
  const insertAtCursor = (
    textareaRef: React.RefObject<HTMLTextAreaElement | null>,
    snippet: string,
    setValue: (value: string) => void,
    currentValue: string
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setValue(currentValue + snippet);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = currentValue.slice(0, start) + snippet + currentValue.slice(end);
    setValue(newValue);
    // Reset cursor position after React re-renders
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = userRole === "ADMIN" || userRole === "PROMPT_ADMIN";

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setLoading(true);
      // Include pending for admin view
      const res = await fetch("/api/instruction-presets?pending=true");
      if (!res.ok) throw new Error("Failed to load presets");
      const data = await res.json();
      setPresets(data.presets || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load presets");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/instruction-presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      await loadPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/instruction-presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      setRejectingId(null);
      setRejectionReason("");
      await loadPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSetDefault = async (id: string, isDefault: boolean) => {
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/instruction-presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault }),
      });
      if (!res.ok) throw new Error("Failed to update default");
      await loadPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDelete();
    if (!confirmed) return;
    setActionInProgress(id);
    try {
      const res = await fetch(`/api/instruction-presets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      await loadPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPreset) return;
    setActionInProgress(editingPreset.id);
    try {
      const res = await fetch(`/api/instruction-presets/${editingPreset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          content: editContent,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEditingPreset(null);
      await loadPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) {
      setError("Name and content are required");
      return;
    }
    setActionInProgress("create");
    try {
      const res = await fetch("/api/instruction-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          content: newContent,
          requestShare: true, // Admin-created presets are auto-shared
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewContent("");
      await loadPresets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setActionInProgress(null);
    }
  };

  const openEdit = (preset: InstructionPreset) => {
    setEditingPreset(preset);
    setEditName(preset.name);
    setEditDescription(preset.description || "");
    setEditContent(preset.content);
  };

  if (status === "loading" || loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={styles.container}>
        <h1 style={{ color: "#dc2626", marginBottom: "16px" }}>Access Denied</h1>
        <p style={{ color: "#64748b" }}>You need admin permissions to access this page.</p>
        <Link href="/" style={{ color: "#0ea5e9" }}>Go Home</Link>
      </div>
    );
  }

  const pendingPresets = presets.filter(p => p.shareStatus === "PENDING_APPROVAL");
  const approvedPresets = presets.filter(p => p.shareStatus === "APPROVED");
  const otherPresets = presets.filter(p => p.shareStatus !== "PENDING_APPROVAL" && p.shareStatus !== "APPROVED");

  return (
    <div style={styles.container}>
      <ConfirmDialog />
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 700 }}>
            Instruction Presets
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            Manage org-wide chat instruction presets and review submissions
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            ...styles.button,
            backgroundColor: "#6366f1",
            color: "#fff",
          }}
        >
          + Create Org Preset
        </button>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "#fee2e2",
          color: "#dc2626",
          borderRadius: "8px",
          marginBottom: "16px",
          fontSize: "14px",
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: "12px", background: "none", border: "none", cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Approval Section */}
      {pendingPresets.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#92400e",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span style={{
              ...styles.badge,
              backgroundColor: statusColors.PENDING_APPROVAL.bg,
              color: statusColors.PENDING_APPROVAL.text,
            }}>
              {pendingPresets.length}
            </span>
            Pending Approval
          </h2>
          {pendingPresets.map(preset => (
            <div
              key={preset.id}
              style={{
                ...styles.card,
                borderColor: statusColors.PENDING_APPROVAL.border,
                backgroundColor: "#fffbeb",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "15px" }}>{preset.name}</strong>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: statusColors.PENDING_APPROVAL.bg,
                      color: statusColors.PENDING_APPROVAL.text,
                    }}>
                      Pending
                    </span>
                  </div>
                  {preset.description && (
                    <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
                      {preset.description}
                    </p>
                  )}
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Submitted by {preset.createdByEmail || "Unknown"} on{" "}
                    {preset.shareRequestedAt ? new Date(preset.shareRequestedAt).toLocaleDateString() : "N/A"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setExpandedId(expandedId === preset.id ? null : preset.id)}
                    style={{
                      ...styles.button,
                      backgroundColor: "#f1f5f9",
                      color: "#475569",
                    }}
                  >
                    {expandedId === preset.id ? "Hide" : "Preview"}
                  </button>
                  <button
                    onClick={() => handleApprove(preset.id)}
                    disabled={actionInProgress === preset.id}
                    style={{
                      ...styles.button,
                      backgroundColor: "#22c55e",
                      color: "#fff",
                      opacity: actionInProgress === preset.id ? 0.6 : 1,
                    }}
                  >
                    Approve
                  </button>
                  {rejectingId !== preset.id ? (
                    <button
                      onClick={() => setRejectingId(preset.id)}
                      style={{
                        ...styles.button,
                        backgroundColor: "#ef4444",
                        color: "#fff",
                      }}
                    >
                      Reject
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason (optional)"
                        style={{
                          padding: "6px 8px",
                          fontSize: "12px",
                          border: "1px solid #fecaca",
                          borderRadius: "4px",
                          width: "140px",
                        }}
                      />
                      <button
                        onClick={() => handleReject(preset.id)}
                        disabled={actionInProgress === preset.id}
                        style={{
                          ...styles.button,
                          backgroundColor: "#ef4444",
                          color: "#fff",
                          padding: "6px 10px",
                          opacity: actionInProgress === preset.id ? 0.6 : 1,
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                        style={{
                          ...styles.button,
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                          padding: "6px 10px",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {expandedId === preset.id && (
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#fff",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                }}>
                  <pre style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    lineHeight: 1.5,
                    color: "#334155",
                  }}>
                    {preset.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approved Presets Section */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
          Org Presets ({approvedPresets.length})
        </h2>
        {approvedPresets.length === 0 ? (
          <div style={{
            ...styles.card,
            textAlign: "center",
            color: "#64748b",
            padding: "32px",
          }}>
            No org presets yet. Create one to get started.
          </div>
        ) : (
          approvedPresets.map(preset => (
            <div key={preset.id} style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "15px" }}>{preset.name}</strong>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: statusColors.APPROVED.bg,
                      color: statusColors.APPROVED.text,
                    }}>
                      Shared
                    </span>
                    {preset.isDefault && (
                      <span style={{
                        ...styles.badge,
                        backgroundColor: "#dbeafe",
                        color: "#1d4ed8",
                      }}>
                        Default
                      </span>
                    )}
                  </div>
                  {preset.description && (
                    <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "13px" }}>
                      {preset.description}
                    </p>
                  )}
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Created by {preset.createdByEmail || "Unknown"}
                    {preset.approvedAt && ` · Approved ${new Date(preset.approvedAt).toLocaleDateString()}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setExpandedId(expandedId === preset.id ? null : preset.id)}
                    style={{
                      ...styles.button,
                      backgroundColor: "#f1f5f9",
                      color: "#475569",
                    }}
                  >
                    {expandedId === preset.id ? "Hide" : "Preview"}
                  </button>
                  <button
                    onClick={() => openEdit(preset)}
                    style={{
                      ...styles.button,
                      backgroundColor: "#f0f9ff",
                      color: "#0369a1",
                    }}
                  >
                    Edit
                  </button>
                  {!preset.isDefault && (
                    <button
                      onClick={() => handleSetDefault(preset.id, true)}
                      disabled={actionInProgress === preset.id}
                      style={{
                        ...styles.button,
                        backgroundColor: "#faf5ff",
                        color: "#7c3aed",
                        opacity: actionInProgress === preset.id ? 0.6 : 1,
                      }}
                    >
                      Set Default
                    </button>
                  )}
                  {preset.isDefault && (
                    <button
                      onClick={() => handleSetDefault(preset.id, false)}
                      disabled={actionInProgress === preset.id}
                      style={{
                        ...styles.button,
                        backgroundColor: "#f1f5f9",
                        color: "#64748b",
                        opacity: actionInProgress === preset.id ? 0.6 : 1,
                      }}
                    >
                      Remove Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(preset.id)}
                    disabled={actionInProgress === preset.id}
                    style={{
                      ...styles.button,
                      backgroundColor: "#fff",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      opacity: actionInProgress === preset.id ? 0.6 : 1,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {expandedId === preset.id && (
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                }}>
                  <pre style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    lineHeight: 1.5,
                    color: "#334155",
                  }}>
                    {preset.content}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Other Presets (Private/Rejected) */}
      {otherPresets.length > 0 && (
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px", color: "#64748b" }}>
            Other Presets ({otherPresets.length})
          </h2>
          {otherPresets.map(preset => (
            <div key={preset.id} style={{ ...styles.card, opacity: 0.7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "15px" }}>{preset.name}</strong>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: statusColors[preset.shareStatus].bg,
                      color: statusColors[preset.shareStatus].text,
                    }}>
                      {preset.shareStatus === "REJECTED" ? "Rejected" : "Private"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    By {preset.createdByEmail || "Unknown"}
                    {preset.rejectionReason && ` · Rejection reason: ${preset.rejectionReason}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setExpandedId(expandedId === preset.id ? null : preset.id)}
                    style={{
                      ...styles.button,
                      backgroundColor: "#f1f5f9",
                      color: "#475569",
                    }}
                  >
                    {expandedId === preset.id ? "Hide" : "Preview"}
                  </button>
                  <button
                    onClick={() => handleDelete(preset.id)}
                    style={{
                      ...styles.button,
                      backgroundColor: "#fff",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {expandedId === preset.id && (
                <div style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "6px",
                }}>
                  <pre style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}>
                    {preset.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingPreset && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            padding: "24px",
            width: "90%",
            maxWidth: "600px",
            maxHeight: "90vh",
            overflow: "auto",
          }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Edit Preset</h3>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Description
              </label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Brief description (optional)"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500 }}>
                  Instructions
                </label>
                <SnippetPicker
                  onInsert={(snippet) => insertAtCursor(editTextareaRef, snippet, setEditContent, editContent)}
                />
              </div>
              <textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "200px",
                  padding: "12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
              <p style={{ marginTop: "4px", fontSize: "11px", color: "#94a3b8" }}>
                Use {"{{snippet_key}}"} to insert context snippets. They'll be expanded when the preset is applied.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditingPreset(null)}
                style={{
                  ...styles.button,
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={actionInProgress === editingPreset.id}
                style={{
                  ...styles.button,
                  backgroundColor: "#6366f1",
                  color: "#fff",
                  opacity: actionInProgress === editingPreset.id ? 0.6 : 1,
                }}
              >
                {actionInProgress === editingPreset.id ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            padding: "24px",
            width: "90%",
            maxWidth: "600px",
            maxHeight: "90vh",
            overflow: "auto",
          }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Create Org Preset</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
              This preset will be immediately available to all users.
            </p>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Security Questionnaire Expert"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "4px" }}>
                Description
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description of when to use this preset"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500 }}>
                  Instructions *
                </label>
                <SnippetPicker
                  onInsert={(snippet) => insertAtCursor(createTextareaRef, snippet, setNewContent, newContent)}
                />
              </div>
              <textarea
                ref={createTextareaRef}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Enter the instruction text that will guide the AI's behavior..."
                style={{
                  width: "100%",
                  minHeight: "200px",
                  padding: "12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
              <p style={{ marginTop: "4px", fontSize: "11px", color: "#94a3b8" }}>
                Use {"{{snippet_key}}"} to insert context snippets. They'll be expanded when the preset is applied.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowCreate(false); setNewName(""); setNewDescription(""); setNewContent(""); }}
                style={{
                  ...styles.button,
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={actionInProgress === "create" || !newName.trim() || !newContent.trim()}
                style={{
                  ...styles.button,
                  backgroundColor: "#6366f1",
                  color: "#fff",
                  opacity: (actionInProgress === "create" || !newName.trim() || !newContent.trim()) ? 0.6 : 1,
                }}
              >
                {actionInProgress === "create" ? "Creating..." : "Create Preset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
