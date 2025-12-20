"use client";

import { useState, useMemo } from "react";
import { useConfirm } from "@/components/ConfirmModal";
import { InlineError } from "@/components/ui/status-display";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import {
  EditPresetModal,
  CreatePresetModal,
  statusColors,
  InstructionPreset,
} from "./index";

// Panel resize constants
const DETAIL_MIN_WIDTH = 350;
const DETAIL_MAX_WIDTH = 600;
const DETAIL_DEFAULT_WIDTH = 420;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["approved", "pending"])
  );
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [copied, setCopied] = useState(false);

  // Edit state (inline in detail panel)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");

  const { confirm: confirmDelete, ConfirmDialog } = useConfirm({
    title: "Delete Preset",
    message: "Are you sure you want to delete this preset?",
    confirmLabel: "Delete",
    variant: "danger",
  });

  // Resizable detail panel
  const {
    panelWidth: detailWidth,
    isDragging,
    containerRef,
    handleMouseDown,
    minWidth: detailMinWidth,
    maxWidth: detailMaxWidth,
  } = useResizablePanel({
    storageKey: "personas-detail-panel-width",
    defaultWidth: DETAIL_DEFAULT_WIDTH,
    minWidth: DETAIL_MIN_WIDTH,
    maxWidth: DETAIL_MAX_WIDTH,
  });

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
      setIsEditing(false);
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
    onSuccess: () => {
      if (selectedPresetId) {
        setSelectedPresetId(null);
      }
    },
    onError: (err) => {
      setError(err.message || "Failed to delete");
    },
    onSettled: () => {
      setActionInProgress(null);
    },
  });

  // Filter presets by search
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return presets;
    const query = searchQuery.toLowerCase();
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query)
    );
  }, [presets, searchQuery]);

  // Group presets by status
  const pendingPresets = filteredPresets.filter(
    (p) => p.shareStatus === "PENDING_APPROVAL"
  );
  const approvedPresets = filteredPresets.filter(
    (p) => p.shareStatus === "APPROVED"
  );
  const otherPresets = filteredPresets.filter(
    (p) => p.shareStatus !== "PENDING_APPROVAL" && p.shareStatus !== "APPROVED"
  );

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleSelectPreset = (preset: InstructionPreset) => {
    setSelectedPresetId(preset.id);
    setIsEditing(false);
    setEditName(preset.name);
    setEditDescription(preset.description || "");
    setEditContent(preset.content);
  };

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
    if (!selectedPreset) return;
    setActionInProgress(selectedPreset.id);
    updateMutation.mutate({
      id: selectedPreset.id,
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

  const handleCopyContent = async () => {
    if (!selectedPreset) return;
    await navigator.clipboard.writeText(selectedPreset.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEdit = () => {
    if (!selectedPreset) return;
    setEditName(selectedPreset.name);
    setEditDescription(selectedPreset.description || "");
    setEditContent(selectedPreset.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (selectedPreset) {
      setEditName(selectedPreset.name);
      setEditDescription(selectedPreset.description || "");
      setEditContent(selectedPreset.content);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      <ConfirmDialog />

      {/* Left Column - List */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* Search & Actions Header */}
        <div className="flex-shrink-0 p-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search personas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Persona
            </button>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>{filteredPresets.length} personas</span>
            {pendingPresets.length > 0 && (
              <span className="text-amber-600">
                {pendingPresets.length} pending approval
              </span>
            )}
          </div>
        </div>

        {/* Error */}
        {(error || queryError) && (
          <div className="p-4 pt-0">
            <InlineError
              message={error || queryError?.message || "An error occurred"}
              onDismiss={error ? () => setError(null) : undefined}
            />
          </div>
        )}

        {/* Preset List */}
        <div className="flex-1 overflow-y-auto">
          {/* Pending Section */}
          {pendingPresets.length > 0 && (
            <PresetSection
              title="Pending Approval"
              count={pendingPresets.length}
              icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
              expanded={expandedSections.has("pending")}
              onToggle={() => toggleSection("pending")}
              variant="warning"
            >
              {pendingPresets.map((preset) => (
                <PresetListItem
                  key={preset.id}
                  preset={preset}
                  selected={selectedPresetId === preset.id}
                  onClick={() => handleSelectPreset(preset)}
                />
              ))}
            </PresetSection>
          )}

          {/* Approved Section */}
          <PresetSection
            title="Org Personas"
            count={approvedPresets.length}
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            expanded={expandedSections.has("approved")}
            onToggle={() => toggleSection("approved")}
          >
            {approvedPresets.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No org personas yet. Create one to get started.
              </div>
            ) : (
              approvedPresets.map((preset) => (
                <PresetListItem
                  key={preset.id}
                  preset={preset}
                  selected={selectedPresetId === preset.id}
                  onClick={() => handleSelectPreset(preset)}
                />
              ))
            )}
          </PresetSection>

          {/* Other Section */}
          {otherPresets.length > 0 && (
            <PresetSection
              title="Other"
              count={otherPresets.length}
              icon={<User className="h-4 w-4 text-muted-foreground" />}
              expanded={expandedSections.has("other")}
              onToggle={() => toggleSection("other")}
              variant="muted"
            >
              {otherPresets.map((preset) => (
                <PresetListItem
                  key={preset.id}
                  preset={preset}
                  selected={selectedPresetId === preset.id}
                  onClick={() => handleSelectPreset(preset)}
                />
              ))}
            </PresetSection>
          )}
        </div>
      </div>

      {/* Resizable Divider */}
      <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />

      {/* Right Column - Detail Panel */}
      <div
        style={{
          width: `${detailWidth}px`,
          minWidth: `${detailMinWidth}px`,
          maxWidth: `${detailMaxWidth}px`,
        }}
        className="flex flex-col bg-muted/30 flex-shrink-0"
      >
        {selectedPreset ? (
          <>
            {/* Detail Header */}
            <div className="flex-shrink-0 p-4 border-b border-border bg-background">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-lg font-semibold border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ) : (
                    <h3 className="text-lg font-semibold truncate">
                      {selectedPreset.name}
                    </h3>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          statusColors[selectedPreset.shareStatus].bg,
                        color: statusColors[selectedPreset.shareStatus].text,
                      }}
                    >
                      {selectedPreset.shareStatus === "APPROVED"
                        ? "Shared"
                        : selectedPreset.shareStatus.replace("_", " ")}
                    </span>
                    {selectedPreset.isDefault && (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </span>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyContent}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                      title="Copy content"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              {isEditing ? (
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="w-full mt-2 text-sm border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              ) : (
                selectedPreset.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {selectedPreset.description}
                  </p>
                )
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {selectedPreset.approvedAt
                    ? `Approved ${new Date(selectedPreset.approvedAt).toLocaleDateString()}`
                    : `Created ${new Date(selectedPreset.createdAt).toLocaleDateString()}`}
                </span>
                {selectedPreset.createdByEmail && (
                  <span>by {selectedPreset.createdByEmail}</span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Instructions
              </label>
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-[calc(100%-24px)] min-h-[300px] p-3 text-sm font-mono border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              ) : (
                <pre className="text-sm font-mono bg-background border border-border rounded-lg p-3 whitespace-pre-wrap overflow-auto max-h-[calc(100vh-400px)]">
                  {selectedPreset.content}
                </pre>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex-shrink-0 p-4 border-t border-border bg-background">
              {selectedPreset.shareStatus === "PENDING_APPROVAL" ? (
                // Pending actions
                <div className="space-y-3">
                  {rejectingId === selectedPreset.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        className="w-full p-2 text-sm border border-border rounded resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(selectedPreset.id)}
                          disabled={actionInProgress === selectedPreset.id}
                          className="flex-1 py-2 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionReason("");
                          }}
                          className="px-4 py-2 border border-border rounded text-sm hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(selectedPreset.id)}
                        disabled={actionInProgress === selectedPreset.id}
                        className="flex-1 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectingId(selectedPreset.id)}
                        disabled={actionInProgress === selectedPreset.id}
                        className="flex-1 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ) : isEditing ? (
                // Edit mode actions
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={actionInProgress === selectedPreset.id}
                    className="flex-1 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {actionInProgress === selectedPreset.id
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-border rounded text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                // Normal actions for approved presets
                <div className="flex gap-2">
                  <button
                    onClick={startEdit}
                    className="flex-1 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      handleSetDefault(
                        selectedPreset.id,
                        !selectedPreset.isDefault
                      )
                    }
                    disabled={actionInProgress === selectedPreset.id}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      selectedPreset.isDefault
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : "border border-border hover:bg-muted"
                    }`}
                  >
                    {selectedPreset.isDefault ? "Remove Default" : "Set Default"}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedPreset.id)}
                    disabled={actionInProgress === selectedPreset.id}
                    className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          // Empty state
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a persona to view details</p>
            </div>
          </div>
        )}
      </div>

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

// Collapsible section component
function PresetSection({
  title,
  count,
  icon,
  expanded,
  onToggle,
  variant = "default",
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  variant?: "default" | "warning" | "muted";
  children: React.ReactNode;
}) {
  const bgColors = {
    default: "bg-background",
    warning: "bg-amber-50",
    muted: "bg-muted/50",
  };

  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors ${bgColors[variant]}`}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon}
        <span className="font-medium text-sm">{title}</span>
        <span className="text-xs text-muted-foreground">({count})</span>
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

// List item component
function PresetListItem({
  preset,
  selected,
  onClick,
}: {
  preset: InstructionPreset;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${
        selected ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate flex-1">
          {preset.name}
        </span>
        {preset.isDefault && (
          <Star className="h-3 w-3 text-amber-500 fill-current flex-shrink-0" />
        )}
      </div>
      {preset.description && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {preset.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <span>
          {preset.approvedAt
            ? new Date(preset.approvedAt).toLocaleDateString()
            : new Date(preset.createdAt).toLocaleDateString()}
        </span>
        {preset.createdByEmail && (
          <>
            <span>•</span>
            <span className="truncate">{preset.createdByEmail.split("@")[0]}</span>
          </>
        )}
      </div>
    </button>
  );
}
