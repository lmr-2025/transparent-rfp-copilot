"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  ModalContainer,
  ModalHeader,
  ModalFooter,
  modalStyles,
  variantColors,
  ModalVariant,
} from "./ui/modal";

// Re-export modal utilities for use by other components
export { ModalContainer, ModalHeader, ModalFooter, modalStyles, variantColors };
export type { ModalVariant };

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

// Keep local styles ref for backward compatibility with existing code
const styles = modalStyles;

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
      // Small delay to ensure modal is rendered
      setTimeout(() => confirmButtonRef.current?.focus(), 50);
    }
  }, [isOpen]);

  return (
    <ModalContainer isOpen={isOpen} onClose={onCancel} ariaLabelledBy="confirm-title">
      <ModalHeader title={title} subtitle={message} titleId="confirm-title" />
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
            ...styles.primaryButton,
            backgroundColor: variantColors[variant],
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalContainer>
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

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <ModalContainer isOpen={isOpen} onClose={onCancel} ariaLabelledBy="prompt-title">
      <ModalHeader title={title} subtitle={message} titleId="prompt-title" />
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
            ...styles.primaryButton,
            backgroundColor: value.trim() ? variantColors.default : "#94a3b8",
            cursor: value.trim() ? "pointer" : "not-allowed",
          }}
        >
          {submitLabel}
        </button>
      </div>
    </ModalContainer>
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

  const handleSubmit = () => {
    onSubmit(value);
  };

  return (
    <ModalContainer isOpen={isOpen} onClose={onCancel} width="wide" ariaLabelledBy="textarea-prompt-title">
      <ModalHeader title={title} subtitle={message} titleId="textarea-prompt-title" />
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
            ...styles.primaryButton,
            backgroundColor: variantColors.default,
          }}
        >
          {submitLabel}
        </button>
      </div>
    </ModalContainer>
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
