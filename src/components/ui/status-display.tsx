"use client";

import { ReactNode } from "react";
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared status display styles
 */
export const statusStyles = {
  error: {
    container: "bg-red-50 border-red-200 text-red-800",
    icon: "text-red-600",
    title: "text-red-800",
    message: "text-red-700",
  },
  success: {
    container: "bg-green-50 border-green-200 text-green-800",
    icon: "text-green-600",
    title: "text-green-800",
    message: "text-green-700",
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-800",
    icon: "text-amber-600",
    title: "text-amber-800",
    message: "text-amber-700",
  },
  info: {
    container: "bg-blue-50 border-blue-200 text-blue-800",
    icon: "text-blue-600",
    title: "text-blue-800",
    message: "text-blue-700",
  },
};

/**
 * Inline styles for components not using Tailwind
 */
export const statusInlineStyles = {
  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  warning: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fcd34d",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
  info: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
    border: "1px solid #93c5fd",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "16px",
  },
};

type StatusVariant = "error" | "success" | "warning" | "info";

const variantIcons: Record<StatusVariant, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

/**
 * StatusDisplay - Unified component for error, success, warning, info messages
 */
type StatusDisplayProps = {
  variant: StatusVariant;
  title?: string;
  message: string | ReactNode;
  onDismiss?: () => void;
  className?: string;
  showIcon?: boolean;
};

export function StatusDisplay({
  variant,
  title,
  message,
  onDismiss,
  className,
  showIcon = true,
}: StatusDisplayProps) {
  const styles = statusStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <div
      className={cn(
        "border rounded-md p-3 flex items-start gap-3",
        styles.container,
        className
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      {showIcon && (
        <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", styles.icon)} />
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <div className={cn("font-semibold text-sm mb-1", styles.title)}>
            {title}
          </div>
        )}
        <div className={cn("text-sm", styles.message)}>{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            "flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors",
            styles.icon
          )}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * ErrorDisplay - Convenience wrapper for error variant
 */
type ErrorDisplayProps = Omit<StatusDisplayProps, "variant">;

export function ErrorDisplay(props: ErrorDisplayProps) {
  return <StatusDisplay variant="error" {...props} />;
}

/**
 * SuccessDisplay - Convenience wrapper for success variant
 */
type SuccessDisplayProps = Omit<StatusDisplayProps, "variant">;

export function SuccessDisplay(props: SuccessDisplayProps) {
  return <StatusDisplay variant="success" {...props} />;
}

/**
 * WarningDisplay - Convenience wrapper for warning variant
 */
type WarningDisplayProps = Omit<StatusDisplayProps, "variant">;

export function WarningDisplay(props: WarningDisplayProps) {
  return <StatusDisplay variant="warning" {...props} />;
}

/**
 * InfoDisplay - Convenience wrapper for info variant
 */
type InfoDisplayProps = Omit<StatusDisplayProps, "variant">;

export function InfoDisplay(props: InfoDisplayProps) {
  return <StatusDisplay variant="info" {...props} />;
}

/**
 * InlineError - Simple inline error for forms (styled div, no Tailwind)
 * Use for compatibility with existing inline-styled components
 */
type InlineStatusProps = {
  message: string;
  onDismiss?: () => void;
};

export function InlineError({ message, onDismiss }: InlineStatusProps) {
  return (
    <div style={statusInlineStyles.error}>
      {message}
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            marginLeft: "12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            textDecoration: "underline",
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function InlineSuccess({ message, onDismiss }: InlineStatusProps) {
  return (
    <div style={statusInlineStyles.success}>
      {message}
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            marginLeft: "12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            textDecoration: "underline",
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
