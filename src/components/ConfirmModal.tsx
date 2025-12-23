"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

export type ModalVariant = "danger" | "warning" | "default" | "success";

export const variantColors: Record<ModalVariant, string> = {
  danger: "#dc2626",
  warning: "#f59e0b",
  default: "#3b82f6",
  success: "#16a34a",
};

const variantButtonClasses: Record<ModalVariant, string> = {
  danger: "bg-red-600 hover:bg-red-700",
  warning: "bg-amber-500 hover:bg-amber-600",
  default: "bg-blue-500 hover:bg-blue-600",
  success: "bg-green-600 hover:bg-green-700",
};

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={variantButtonClasses[variant]}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

export function PromptModal(props: PromptModalProps) {
  if (!props.isOpen) {
    return null;
  }
  return <PromptModalInner {...props} />;
}

function PromptModalInner({
  title,
  message,
  placeholder = "",
  defaultValue = "",
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
}: Omit<PromptModalProps, "isOpen">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValueState] = useState(defaultValue);

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {message && <DialogDescription>{message}</DialogDescription>}
        </DialogHeader>
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
          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

export function TextareaPromptModal(props: TextareaPromptModalProps) {
  if (!props.isOpen) {
    return null;
  }
  return <TextareaPromptModalInner {...props} />;
}

function TextareaPromptModalInner({
  title,
  message,
  placeholder = "",
  defaultValue = "",
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
}: Omit<TextareaPromptModalProps, "isOpen">) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValueState] = useState(defaultValue);

  useEffect(() => {
    const timeout = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = () => {
    onSubmit(value);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {message && <DialogDescription>{message}</DialogDescription>}
        </DialogHeader>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValueState(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg min-h-[150px] resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-500 hover:bg-blue-600">
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
