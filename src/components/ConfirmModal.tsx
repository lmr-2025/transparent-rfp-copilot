"use client";

import { useEffect, useRef, useCallback } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

const styles = {
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
  title: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: "8px",
  },
  message: {
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
  confirmButton: {
    border: "none",
    color: "#fff",
  },
};

const variantColors = {
  danger: "#dc2626",
  warning: "#f59e0b",
  default: "#3b82f6",
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when modal opens
  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
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

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div style={styles.modal}>
        <h2 id="confirm-title" style={styles.title}>
          {title}
        </h2>
        <p style={styles.message}>{message}</p>
        <div style={styles.buttonRow}>
          <button
            onClick={onCancel}
            style={{ ...styles.button, ...styles.cancelButton }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            style={{
              ...styles.button,
              ...styles.confirmButton,
              backgroundColor: variantColors[variant],
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage with async/await pattern
import { useState } from "react";

interface UseConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

interface UseConfirmReturn {
  confirm: (options?: Partial<UseConfirmOptions>) => Promise<boolean>;
  ConfirmDialog: React.FC;
}

export function useConfirm(defaultOptions: UseConfirmOptions): UseConfirmReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (overrideOptions?: Partial<UseConfirmOptions>): Promise<boolean> => {
      setOptions({ ...defaultOptions, ...overrideOptions });
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [defaultOptions]
  );

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
  }, []);

  const ConfirmDialog: React.FC = useCallback(
    () => (
      <ConfirmModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        variant={options.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [isOpen, options, handleConfirm, handleCancel]
  );

  return { confirm, ConfirmDialog };
}

// ============================================
// PROMPT MODAL (for text input)
// ============================================

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const promptStyles = {
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    marginBottom: "20px",
    outline: "none",
  },
};

export function PromptModal({
  isOpen,
  title,
  message,
  placeholder = "",
  defaultValue = "",
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
}: PromptModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValueState] = useState(defaultValue);

  // Reset value and focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setValueState(defaultValue);
      // Small delay to ensure the modal is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-title"
    >
      <div style={styles.modal}>
        <h2 id="prompt-title" style={styles.title}>
          {title}
        </h2>
        {message && <p style={styles.message}>{message}</p>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValueState(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={placeholder}
          style={promptStyles.input}
        />
        <div style={styles.buttonRow}>
          <button
            onClick={onCancel}
            style={{ ...styles.button, ...styles.cancelButton }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            style={{
              ...styles.button,
              ...styles.confirmButton,
              backgroundColor: value.trim() ? variantColors.default : "#94a3b8",
              cursor: value.trim() ? "pointer" : "not-allowed",
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage with async/await pattern
interface UsePromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

interface UsePromptReturn {
  prompt: (options?: Partial<UsePromptOptions>) => Promise<string | null>;
  PromptDialog: React.FC;
}

export function usePrompt(defaultOptions: UsePromptOptions): UsePromptReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const promptFn = useCallback(
    (overrideOptions?: Partial<UsePromptOptions>): Promise<string | null> => {
      setOptions({ ...defaultOptions, ...overrideOptions });
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [defaultOptions]
  );

  const handleSubmit = useCallback((value: string) => {
    setIsOpen(false);
    resolveRef.current?.(value);
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(null);
  }, []);

  const PromptDialog: React.FC = useCallback(
    () => (
      <PromptModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        placeholder={options.placeholder}
        defaultValue={options.defaultValue}
        submitLabel={options.submitLabel}
        cancelLabel={options.cancelLabel}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    ),
    [isOpen, options, handleSubmit, handleCancel]
  );

  return { prompt: promptFn, PromptDialog };
}

// ============================================
// TEXTAREA PROMPT MODAL (for multiline input)
// ============================================

interface TextareaPromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const textareaStyles = {
  textarea: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    marginBottom: "20px",
    outline: "none",
    minHeight: "150px",
    resize: "vertical" as const,
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
};

export function TextareaPromptModal({
  isOpen,
  title,
  message,
  placeholder = "",
  defaultValue = "",
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
}: TextareaPromptModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValueState] = useState(defaultValue);

  // Reset value and focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setValueState(defaultValue);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleSubmit = () => {
    onSubmit(value);
  };

  if (!isOpen) return null;

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="textarea-prompt-title"
    >
      <div style={{ ...styles.modal, maxWidth: "600px" }}>
        <h2 id="textarea-prompt-title" style={styles.title}>
          {title}
        </h2>
        {message && <p style={styles.message}>{message}</p>}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValueState(e.target.value)}
          placeholder={placeholder}
          style={textareaStyles.textarea}
        />
        <div style={styles.buttonRow}>
          <button
            onClick={onCancel}
            style={{ ...styles.button, ...styles.cancelButton }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleSubmit}
            style={{
              ...styles.button,
              ...styles.confirmButton,
              backgroundColor: variantColors.default,
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for textarea prompt with async/await
interface UseTextareaPromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

interface UseTextareaPromptReturn {
  prompt: (options?: Partial<UseTextareaPromptOptions>) => Promise<string | null>;
  TextareaPromptDialog: React.FC;
}

export function useTextareaPrompt(defaultOptions: UseTextareaPromptOptions): UseTextareaPromptReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const promptFn = useCallback(
    (overrideOptions?: Partial<UseTextareaPromptOptions>): Promise<string | null> => {
      setOptions({ ...defaultOptions, ...overrideOptions });
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [defaultOptions]
  );

  const handleSubmit = useCallback((value: string) => {
    setIsOpen(false);
    resolveRef.current?.(value);
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(null);
  }, []);

  const TextareaPromptDialog: React.FC = useCallback(
    () => (
      <TextareaPromptModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        placeholder={options.placeholder}
        defaultValue={options.defaultValue}
        submitLabel={options.submitLabel}
        cancelLabel={options.cancelLabel}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    ),
    [isOpen, options, handleSubmit, handleCancel]
  );

  return { prompt: promptFn, TextareaPromptDialog };
}
