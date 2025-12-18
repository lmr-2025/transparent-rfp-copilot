"use client";

import { useState } from "react";
import { useConfirm } from "@/components/ConfirmModal";
import { InlineError } from "@/components/ui/status-display";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import {
  PresetCard,
  EditPresetModal,
  CreatePresetModal,
  styles,
  statusColors,
  InstructionPreset,
} from "./index";

// Types for mutations
type UpdatePresetInput = {
  id: string;
  data: {
    action?: "approve" | "reject";
    rejectionReason?: string;
    isDefault?: boolean;
    name?: string;
    description?: string;
    content?: string;
  };
};

type CreatePresetInput = {
  name: string;
  description: string;
  content: string;
  requestShare: boolean;
};

export default function PresetsTab() {
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

  // Fetch presets
  const {
    data: presets = [],
    isLoading: loading,
    error: queryError,
  } = useApiQuery<InstructionPreset[]>({
    queryKey: ["instruction-presets"],
    url: "/api/instruction-presets",
    params: { pending: true },
    responseKey: "presets",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  // Update preset mutation
  const updateMutation = useApiMutation<void, UpdatePresetInput>({
    url: (vars) => `/api/instruction-presets/${vars.id}`,
    method: "PUT",
    invalidateKeys: [["instruction-presets"]],
    onSuccess: () => {
      setRejectingId(null);
      setRejectionReason("");
      setEditingPreset(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to update");
    },
    onSettled: () => {
      setActionInProgress(null);
    },
  });

  // Create preset mutation
  const createMutation = useApiMutation<void, CreatePresetInput>({
    url: "/api/instruction-presets",
    method: "POST",
    invalidateKeys: [["instruction-presets"]],
    onSuccess: () => {
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewContent("");
    },
    onError: (err) => {
      setError(err.message || "Failed to create");
    },
    onSettled: () => {
      setActionInProgress(null);
    },
  });

  // Delete preset mutation
  const deleteMutation = useApiMutation<void, string>({
    url: (id) => `/api/instruction-presets/${id}`,
    method: "DELETE",
    invalidateKeys: [["instruction-presets"]],
    onError: (err) => {
      setError(err.message || "Failed to delete");
    },
    onSettled: () => {
      setActionInProgress(null);
    },
  });

  const handleApprove = (id: string) => {
    setActionInProgress(id);
    updateMutation.mutate({ id, data: { action: "approve" } });
  };

  const handleReject = (id: string) => {
    setActionInProgress(id);
    updateMutation.mutate({ id, data: { action: "reject", rejectionReason } });
  };

  const handleSetDefault = (id: string, isDefault: boolean) => {
    setActionInProgress(id);
    updateMutation.mutate({ id, data: { isDefault } });
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDelete();
    if (!confirmed) return;
    setActionInProgress(id);
    deleteMutation.mutate(id);
  };

  const handleSaveEdit = () => {
    if (!editingPreset) return;
    setActionInProgress(editingPreset.id);
    updateMutation.mutate({
      id: editingPreset.id,
      data: {
        name: editName,
        description: editDescription,
        content: editContent,
      },
    });
  };

  const handleCreate = () => {
    if (!newName.trim() || !newContent.trim()) {
      setError("Name and content are required");
      return;
    }
    setActionInProgress("create");
    createMutation.mutate({
      name: newName,
      description: newDescription,
      content: newContent,
      requestShare: true,
    });
  };

  const openEdit = (preset: InstructionPreset) => {
    setEditingPreset(preset);
    setEditName(preset.name);
    setEditDescription(preset.description || "");
    setEditContent(preset.content);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
        Loading...
      </div>
    );
  }

  const pendingPresets = presets.filter(p => p.shareStatus === "PENDING_APPROVAL");
  const approvedPresets = presets.filter(p => p.shareStatus === "APPROVED");
  const otherPresets = presets.filter(p => p.shareStatus !== "PENDING_APPROVAL" && p.shareStatus !== "APPROVED");

  return (
    <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
      <ConfirmDialog />

      {/* Header with Create button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
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

      {(error || queryError) && (
        <div style={{ marginBottom: "16px" }}>
          <InlineError
            message={error || queryError?.message || "An error occurred"}
            onDismiss={error ? () => setError(null) : undefined}
          />
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
      <EditPresetModal
        isOpen={!!editingPreset}
        preset={editingPreset!}
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

      {/* Create Modal */}
      <CreatePresetModal
        isOpen={showCreate}
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
    </div>
  );
}
