"use client";

import { useEffect, useCallback, ReactNode, CSSProperties } from "react";

/**
 * Shared modal styles for inline-styled modals
 * These match the existing patterns in ConfirmModal.tsx
 */
export const modalStyles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "420px",
    width: "90%",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  },
  modalWide: {
    maxWidth: "600px",
  },
  modalExtraWide: {
    maxWidth: "800px",
  },
  // Additional preset widths for larger modals
  modalLarge: {
    maxWidth: "900px",
  },
  modalXLarge: {
    maxWidth: "1000px",
  },
  modalFull: {
    maxWidth: "1100px",
  },
  title: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: "24px",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },
  primaryButton: {
    border: "none",
    color: "#fff",
    backgroundColor: "#3b82f6",
  },
  dangerButton: {
    border: "none",
    color: "#fff",
    backgroundColor: "#dc2626",
  },
  warningButton: {
    border: "none",
    color: "#fff",
    backgroundColor: "#f59e0b",
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
    cursor: "not-allowed",
  },
};

export const variantColors = {
  danger: "#dc2626",
  warning: "#f59e0b",
  default: "#3b82f6",
  success: "#16a34a",
};

export type ModalVariant = keyof typeof variantColors;

/**
 * ModalContainer - Reusable modal wrapper with common behavior
 * Handles: overlay, keyboard (Escape), click-outside, body scroll prevention, ARIA
 */
type ModalContainerProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Preset width options or custom max-width value (e.g., "900px") */
  width?: "default" | "wide" | "extra-wide" | "large" | "xlarge" | "full" | string;
  /** Override modal content styles (merged with defaults) */
  contentStyle?: CSSProperties;
  /** Override overlay styles (merged with defaults) */
  overlayStyle?: CSSProperties;
  /** Whether to apply default padding (default: true) */
  padding?: boolean;
  ariaLabelledBy?: string;
};

export function ModalContainer({
  isOpen,
  onClose,
  children,
  width = "default",
  contentStyle,
  overlayStyle,
  padding = true,
  ariaLabelledBy = "modal-title",
}: ModalContainerProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Resolve width to a style object
  const widthStyle = (() => {
    switch (width) {
      case "default": return {};
      case "wide": return modalStyles.modalWide;
      case "extra-wide": return modalStyles.modalExtraWide;
      case "large": return modalStyles.modalLarge;
      case "xlarge": return modalStyles.modalXLarge;
      case "full": return modalStyles.modalFull;
      default: return { maxWidth: width }; // Custom width string
    }
  })();

  return (
    <div
      style={{ ...modalStyles.overlay, ...overlayStyle }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <div style={{
        ...modalStyles.modal,
        ...widthStyle,
        ...(padding ? {} : { padding: 0 }),
        ...contentStyle,
      }}>
        {children}
      </div>
    </div>
  );
}

/**
 * ModalHeader - Standard modal header with title and optional subtitle
 */
type ModalHeaderProps = {
  title: string;
  subtitle?: string;
  titleId?: string;
};

export function ModalHeader({ title, subtitle, titleId = "modal-title" }: ModalHeaderProps) {
  return (
    <>
      <h2 id={titleId} style={modalStyles.title}>
        {title}
      </h2>
      {subtitle && <p style={modalStyles.subtitle}>{subtitle}</p>}
    </>
  );
}

/**
 * ModalFooter - Standard modal footer with cancel and action buttons
 */
type ModalFooterProps = {
  onCancel: () => void;
  onAction: () => void;
  cancelLabel?: string;
  actionLabel?: string;
  variant?: ModalVariant;
  actionDisabled?: boolean;
};

export function ModalFooter({
  onCancel,
  onAction,
  cancelLabel = "Cancel",
  actionLabel = "Confirm",
  variant = "default",
  actionDisabled = false,
}: ModalFooterProps) {
  return (
    <div style={modalStyles.buttonRow}>
      <button
        onClick={onCancel}
        style={{ ...modalStyles.button, ...modalStyles.cancelButton }}
      >
        {cancelLabel}
      </button>
      <button
        onClick={onAction}
        disabled={actionDisabled}
        style={{
          ...modalStyles.button,
          ...modalStyles.primaryButton,
          backgroundColor: actionDisabled ? "#94a3b8" : variantColors[variant],
          cursor: actionDisabled ? "not-allowed" : "pointer",
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}
