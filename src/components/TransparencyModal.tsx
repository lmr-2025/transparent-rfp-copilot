"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TransparencyConfig = {
  label: string;
  value: string | number;
  color: "purple" | "blue" | "yellow" | "green";
};

export type TransparencyModalProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  configs: TransparencyConfig[];
  systemPrompt: string;
  systemPromptNote?: React.ReactNode;
  userPrompt?: string;
  userPromptLabel?: string;
  userPromptNote?: React.ReactNode;
  /** Header background color - defaults to gray */
  headerColor?: "purple" | "blue" | "gray";
};

const colorSchemeClasses = {
  purple: { bg: "bg-purple-50", border: "border-purple-300", label: "text-purple-700", value: "text-purple-900" },
  blue: { bg: "bg-blue-50", border: "border-blue-300", label: "text-sky-700", value: "text-sky-900" },
  yellow: { bg: "bg-amber-100", border: "border-amber-300", label: "text-amber-800", value: "text-amber-900" },
  green: { bg: "bg-green-50", border: "border-green-300", label: "text-green-700", value: "text-green-900" },
};

const headerColorClasses = {
  purple: "bg-purple-50",
  blue: "bg-blue-50",
  gray: "bg-slate-50",
};

const titleColorClasses = {
  purple: "text-purple-700",
  blue: "text-sky-700",
  gray: "text-slate-800",
};

export default function TransparencyModal({
  title,
  subtitle,
  onClose,
  configs,
  systemPrompt,
  systemPromptNote,
  userPrompt,
  userPromptLabel = "User Prompt",
  userPromptNote,
  headerColor = "gray",
}: TransparencyModalProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Custom Header */}
        <DialogHeader className={cn("px-6 py-5 border-b", headerColorClasses[headerColor])}>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className={cn("text-lg", titleColorClasses[headerColor])}>
                {title}
              </DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                {subtitle}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Config Cards */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Model Configuration
            </h4>
            <div className="flex gap-4 flex-wrap">
              {configs.map((config, idx) => {
                const scheme = colorSchemeClasses[config.color];
                return (
                  <div
                    key={idx}
                    className={cn(
                      "px-4 py-3 rounded-lg border",
                      scheme.bg,
                      scheme.border
                    )}
                  >
                    <div className={cn("text-xs font-semibold mb-1", scheme.label)}>
                      {config.label}
                    </div>
                    <div className={cn("text-sm font-mono", scheme.value)}>
                      {typeof config.value === "number" ? config.value.toLocaleString() : config.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Prompt */}
          <div className={userPrompt ? "mb-6" : ""}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              System Prompt
            </h4>
            <div className="bg-slate-800 rounded-lg p-4 overflow-auto max-h-[300px]">
              <pre className="text-sm font-mono text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                {systemPrompt}
              </pre>
            </div>
            {systemPromptNote && (
              <p className="mt-2 text-xs text-slate-500">
                {systemPromptNote}
              </p>
            )}
          </div>

          {/* User Prompt / Context */}
          {userPrompt && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                {userPromptLabel}
              </h4>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 max-h-[300px] overflow-auto">
                <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap break-words leading-relaxed">
                  {userPrompt.length > 5000
                    ? userPrompt.substring(0, 5000) + "\n\n... (truncated for display)"
                    : userPrompt}
                </pre>
              </div>
              {userPromptNote ? (
                <p className="mt-2 text-xs text-slate-500">
                  {userPromptNote}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Total: {userPrompt.length.toLocaleString()} characters
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
