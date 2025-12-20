"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PromptSection = {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  content: string;
  editable?: boolean;
  editableValue?: string;
  onEdit?: (value: string) => void;
  hint?: string;
  placeholder?: boolean; // If true, content is shown with reduced opacity
};

type PromptBuilderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  sections: PromptSection[];
  onReset?: () => void;
};

export default function PromptBuilderModal({
  isOpen,
  onClose,
  title,
  subtitle,
  sections,
  onReset,
}: PromptBuilderModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b flex flex-row justify-between items-start">
          <div>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            {subtitle && (
              <DialogDescription className="text-slate-500 mt-1">
                {subtitle}
              </DialogDescription>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogHeader>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Components */}
          <div className="flex-1 p-5 overflow-y-auto border-r">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Components
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="px-2 py-1 bg-transparent border border-slate-200 rounded text-xs text-slate-500 hover:bg-slate-50"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2 py-1 bg-transparent border border-slate-200 rounded text-xs text-slate-500 hover:bg-slate-50"
                >
                  Collapse All
                </button>
                {onReset && (
                  <button
                    onClick={onReset}
                    className="px-2 py-1 bg-transparent border border-red-200 rounded text-xs text-red-600 hover:bg-red-50"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {sections.map((section, idx) => {
              const isExpanded = expandedSections.has(section.id);
              return (
                <div
                  key={section.id}
                  className="bg-white rounded-xl mb-3 overflow-hidden"
                  style={{ border: `2px solid ${section.borderColor}` }}
                >
                  {/* Dropdown Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`section-content-${section.id}`}
                    onClick={() => toggleSection(section.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSection(section.id);
                      }
                    }}
                    className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none"
                    style={{ backgroundColor: isExpanded ? section.bgColor : "#fff" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: section.color }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div
                          className="font-semibold text-sm"
                          style={{ color: section.textColor }}
                        >
                          {section.label}
                        </div>
                        {section.hint && (
                          <div className="text-xs text-slate-500">{section.hint}</div>
                        )}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-xs text-slate-400 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    >
                      ▼
                    </div>
                  </div>

                  {/* Dropdown Content */}
                  {isExpanded && (
                    <div
                      id={`section-content-${section.id}`}
                      className="p-4"
                      style={{
                        borderTop: `1px solid ${section.borderColor}`,
                        backgroundColor: section.bgColor,
                      }}
                    >
                      {section.editable ? (
                        <textarea
                          value={section.editableValue || ""}
                          onChange={(e) => section.onEdit?.(e.target.value)}
                          className="w-full min-h-[150px] p-3 rounded-lg bg-white font-mono text-xs resize-y"
                          style={{
                            border: `1px solid ${section.borderColor}`,
                            color: section.textColor,
                          }}
                        />
                      ) : (
                        <div
                          className={cn(
                            "rounded-lg p-3 text-xs font-mono whitespace-pre-wrap",
                            section.placeholder ? "bg-transparent border-none opacity-70" : "bg-white"
                          )}
                          style={{
                            border: section.placeholder ? "none" : `1px solid ${section.borderColor}`,
                            color: section.textColor,
                          }}
                        >
                          {section.content}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Assembled Preview */}
          <div className="flex-1 p-5 bg-slate-800 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
              Assembled Prompt Preview
            </h3>

            {sections.map((section) => (
              <div key={section.id} className="mb-5">
                <div
                  className="inline-block px-2.5 py-1 text-white rounded text-[10px] font-semibold mb-2.5 uppercase"
                  style={{ backgroundColor: section.color }}
                >
                  {section.label}
                </div>
                <pre
                  className={cn(
                    "text-xs font-mono whitespace-pre-wrap leading-relaxed",
                    section.placeholder && "opacity-60"
                  )}
                  style={{ color: section.bgColor }}
                >
                  {section.editable ? (section.editableValue || section.content) : section.content}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
