"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useConfirm } from "@/components/ConfirmModal";
import Link from "next/link";

import {
  PresetCard,
  EditPresetModal,
  CreatePresetModal,
  styles,
  statusColors,
  InstructionPreset,
} from "./components";

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

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = userRole === "ADMIN" || userRole === "PROMPT_ADMIN";

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/instruction-presets?pending=true");
      if (!res.ok) throw new Error("Failed to load presets");
      const json = await res.json();
      const data = json.data ?? json;
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
          requestShare: true,
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
            <PresetCard
              key={preset.id}
              preset={preset}
              expanded={expandedId === preset.id}
              onToggleExpand={() => setExpandedId(expandedId === preset.id ? null : preset.id)}
              actionInProgress={actionInProgress}
              variant="pending"
              rejectingId={rejectingId}
              rejectionReason={rejectionReason}
              onSetRejectingId={setRejectingId}
              onSetRejectionReason={setRejectionReason}
              onApprove={handleApprove}
              onReject={handleReject}
            />
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
            <PresetCard
              key={preset.id}
              preset={preset}
              expanded={expandedId === preset.id}
              onToggleExpand={() => setExpandedId(expandedId === preset.id ? null : preset.id)}
              actionInProgress={actionInProgress}
              variant="approved"
              onEdit={openEdit}
              onSetDefault={handleSetDefault}
              onDelete={handleDelete}
            />
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
            <PresetCard
              key={preset.id}
              preset={preset}
              expanded={expandedId === preset.id}
              onToggleExpand={() => setExpandedId(expandedId === preset.id ? null : preset.id)}
              actionInProgress={actionInProgress}
              variant="other"
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingPreset && (
        <EditPresetModal
          preset={editingPreset}
          editName={editName}
          editDescription={editDescription}
          editContent={editContent}
          onSetEditName={setEditName}
          onSetEditDescription={setEditDescription}
          onSetEditContent={setEditContent}
          onSave={handleSaveEdit}
          onClose={() => setEditingPreset(null)}
          actionInProgress={actionInProgress}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreatePresetModal
          newName={newName}
          newDescription={newDescription}
          newContent={newContent}
          onSetNewName={setNewName}
          onSetNewDescription={setNewDescription}
          onSetNewContent={setNewContent}
          onCreate={handleCreate}
          onClose={() => setShowCreate(false)}
          actionInProgress={actionInProgress}
        />
      )}
    </div>
  );
}
