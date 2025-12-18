"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useConfirm } from "@/components/ConfirmModal";
import Link from "next/link";
import { parseApiData } from "@/lib/apiClient";
import {
  PromptBlock,
  PromptModifier,
  PromptContext,
  defaultBlocks,
  defaultModifiers,
  defaultCompositions,
  buildPromptFromBlocks,
} from "@/lib/promptBlocks";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import PromptBlocksEditor from "@/components/PromptBlocksEditor";
import PromptPreviewPanel from "@/components/PromptPreviewPanel";

// Preview panel resize constants
const PREVIEW_MIN_WIDTH = 350;
const PREVIEW_MAX_WIDTH = 700;
const PREVIEW_DEFAULT_WIDTH = 480;

export default function PromptBlocksPage() {
  const { data: session, status } = useSession();
  const [blocks, setBlocks] = useState<PromptBlock[]>(defaultBlocks);
  const [modifiers, setModifiers] = useState<PromptModifier[]>(defaultModifiers);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setLoaded] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewContext, setPreviewContext] = useState<PromptContext>("questions");

  const { confirm: confirmReset, ConfirmDialog } = useConfirm({
    title: "Reset to Defaults",
    message: "Reset all blocks and modifiers to defaults? This cannot be undone.",
    confirmLabel: "Reset",
    variant: "warning",
  });

  // Resizable preview panel
  const {
    panelWidth: previewWidth,
    isDragging,
    containerRef,
    handleMouseDown,
    minWidth: previewMinWidth,
    maxWidth: previewMaxWidth,
  } = useResizablePanel({
    storageKey: "prompt-builder-preview-width",
    defaultWidth: PREVIEW_DEFAULT_WIDTH,
    minWidth: PREVIEW_MIN_WIDTH,
    maxWidth: PREVIEW_MAX_WIDTH,
  });

  // Check if user has prompt management access
  const userCapabilities = session?.user?.capabilities || [];
  const isAdmin = userCapabilities.includes("MANAGE_PROMPTS") || userCapabilities.includes("ADMIN");

  // Load blocks from API
  useEffect(() => {
    async function loadBlocks() {
      try {
        const res = await fetch("/api/prompt-blocks");
        if (res.ok) {
          const json = await res.json();
          const data = parseApiData<{ blocks?: PromptBlock[]; modifiers?: PromptModifier[] }>(json);
          if (data.blocks && data.blocks.length > 0) {
            setBlocks(data.blocks);
          }
          if (data.modifiers && data.modifiers.length > 0) {
            setModifiers(data.modifiers);
          }
        }
      } catch {
        // Silent failure - will use defaults
      } finally {
        setLoaded(true);
      }
    }
    loadBlocks();
  }, []);

  // Auto-save with debounce
  const saveBlocks = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/prompt-blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, modifiers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setLastSaved(new Date());
      setHasChanges(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [blocks, modifiers]);

  const handleBlockChange = (blockId: string, variants: Record<string, string>) => {
    setHasChanges(true);
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, variants: variants as Record<string, string> & { default: string } } : b
    ));
  };

  const handleModifierChange = (modifierId: string, name: string, content: string) => {
    setHasChanges(true);
    setModifiers(prev => prev.map(m =>
      m.id === modifierId ? { ...m, name, content } : m
    ));
  };

  const resetToDefaults = async () => {
    const confirmed = await confirmReset();
    if (confirmed) {
      setHasChanges(true);
      setBlocks(defaultBlocks);
      setModifiers(defaultModifiers);
    }
  };

  // Build preview prompt
  const previewPrompt = buildPromptFromBlocks(
    blocks,
    defaultCompositions.find(c => c.context === previewContext) || defaultCompositions[0],
    { modifiers }
  );

  if (status === "loading") {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1 style={{ color: "#dc2626", marginBottom: "16px" }}>Access Denied</h1>
        <p style={{ color: "#64748b" }}>You need admin permissions to access this page.</p>
        <Link href="/" style={{ color: "#0ea5e9" }}>Go Home</Link>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <ConfirmDialog />
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid #e2e8f0",
        backgroundColor: "#fff",
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 700 }}>
            Prompt Builder
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
            Configure building blocks to compose system prompts
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {/* Save Status */}
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            {saving ? (
              <span>Saving...</span>
            ) : lastSaved ? (
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            ) : hasChanges ? (
              <span style={{ color: "#f59e0b" }}>Unsaved changes</span>
            ) : null}
          </div>
          <button
            onClick={saveBlocks}
            disabled={saving || !hasChanges}
            style={{
              padding: "6px 14px",
              backgroundColor: hasChanges ? "#0ea5e9" : "#e2e8f0",
              color: hasChanges ? "#fff" : "#94a3b8",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              cursor: hasChanges && !saving ? "pointer" : "default",
              fontWeight: 500,
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={resetToDefaults}
            style={{
              padding: "6px 14px",
              backgroundColor: "#fff",
              color: "#64748b",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: "12px 24px",
          backgroundColor: "#fef2f2",
          borderBottom: "1px solid #fecaca",
          color: "#dc2626",
          fontSize: "14px",
          flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Left Column - Editor */}
        <div style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          padding: "24px",
        }}>
          <PromptBlocksEditor
            blocks={blocks}
            modifiers={modifiers}
            compositions={defaultCompositions}
            onBlockChange={handleBlockChange}
            onModifierChange={handleModifierChange}
            saving={saving}
            previewContext={previewContext}
          />
        </div>

        {/* Resizable Divider */}
        <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />

        {/* Right Column - Preview */}
        <div style={{
          width: `${previewWidth}px`,
          minWidth: `${previewMinWidth}px`,
          maxWidth: `${previewMaxWidth}px`,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f8fafc",
          flexShrink: 0,
        }}>
          <PromptPreviewPanel
            blocks={blocks}
            modifiers={modifiers}
            compositions={defaultCompositions}
            previewContext={previewContext}
            onContextChange={setPreviewContext}
            previewPrompt={previewPrompt}
            onBlockChange={handleBlockChange}
          />
        </div>
      </div>
    </div>
  );
}
