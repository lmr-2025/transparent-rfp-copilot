"use client";

import { useState } from "react";
import {
  Layers,
  FileText,
  ArrowRight,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  defaultBlocks as sourceBlocks,
  defaultCompositions,
  type PromptContext,
} from "@/lib/promptBlocks";
import {
  contextNames,
  contextColors,
  promptColors,
  promptCategories,
  appFeatures,
} from "./types";
import { Users, Database } from "lucide-react";

export function OverviewTab() {
  const [selectedPromptId, setSelectedPromptId] = useState<PromptContext | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const selectedComposition = selectedPromptId
    ? defaultCompositions.find(c => c.context === selectedPromptId)
    : null;

  // Build preview of assembled prompt
  const assembledPromptParts = selectedComposition?.blockIds.map(blockId => {
    const block = sourceBlocks.find(b => b.id === blockId);
    const variantId = (selectedPromptId && block?.variants[selectedPromptId])
      ? selectedPromptId
      : "default";
    const content = block?.variants[variantId] || block?.variants.default || "";
    return { blockId, block, content, variantId };
  }) || [];

  // Stats
  const totalBlocks = sourceBlocks.length;
  const totalPrompts = defaultCompositions.length;
  const blocksWithVariants = sourceBlocks.filter(b => Object.keys(b.variants).length > 1).length;

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{totalBlocks}</div>
                <div className="text-sm text-slate-500">Blocks</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{totalPrompts}</div>
                <div className="text-sm text-slate-500">Prompts</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Layers className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{blocksWithVariants}</div>
                <div className="text-sm text-slate-500">Blocks with variants</div>
              </div>
            </div>
          </div>
        </div>

        {/* Features & Knowledge Sources */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="font-semibold text-slate-800 mb-1">Features & Knowledge Sources</h3>
          <p className="text-xs text-slate-500 mb-4">What prompts and data sources power each feature</p>
          <div className="grid grid-cols-2 gap-3">
            {appFeatures.map(feature => (
              <div key={feature.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{feature.name}</div>
                    <div className="text-[11px] text-slate-500">{feature.description}</div>
                  </div>
                  {feature.usesPersona && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full flex items-center gap-0.5 flex-shrink-0">
                      <Users className="h-2.5 w-2.5" /> Persona
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {/* Prompts */}
                  <div className="flex items-start gap-1.5">
                    <Layers className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex gap-1 flex-wrap">
                      {feature.prompts.map(p => (
                        <span key={p} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                          {contextNames[p]}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Sources */}
                  {feature.sources.length > 0 && (
                    <div className="flex items-start gap-1.5">
                      <Database className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="flex gap-1 flex-wrap">
                        {feature.sources.map(s => (
                          <span key={s} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Prompt list by category */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold text-slate-800 mb-4">All Prompts</h3>
            <div className="space-y-4">
              {promptCategories.map(category => {
                const categoryPrompts = defaultCompositions.filter(c =>
                  category.contexts.includes(c.context)
                );
                if (categoryPrompts.length === 0) return null;

                return (
                  <div key={category.id}>
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                      {category.name}
                    </div>
                    <div className="space-y-1">
                      {categoryPrompts.map(comp => {
                        const colors = promptColors[contextColors[comp.context]];
                        const isSelected = selectedPromptId === comp.context;
                        return (
                          <button
                            key={comp.context}
                            onClick={() => {
                              setSelectedPromptId(isSelected ? null : comp.context);
                              setSelectedBlockId(null);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                              isSelected
                                ? "bg-blue-50 border border-blue-200"
                                : "hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn("w-2 h-2 rounded-full", colors?.bg)} />
                              <span className="font-medium text-slate-700">
                                {contextNames[comp.context]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="text-xs">{comp.blockIds.length} blocks</span>
                              <ChevronRight className={cn(
                                "h-4 w-4 transition-transform",
                                isSelected && "rotate-90"
                              )} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Selected prompt details or block list */}
          <div className="bg-white rounded-lg border p-5">
            {selectedPromptId && selectedComposition ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">
                    {contextNames[selectedPromptId]}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {selectedComposition.blockIds.length} blocks
                  </span>
                </div>

                {/* Visual block flow */}
                <div className="mb-4">
                  <div className="flex flex-col">
                    {assembledPromptParts.map(({ blockId, block, variantId }, idx) => {
                      const isSelected = selectedBlockId === blockId;
                      const tierColor = block?.tier === 1 ? "red" : block?.tier === 2 ? "amber" : "green";
                      const tierBg = tierColor === "red" ? "bg-red-500" : tierColor === "amber" ? "bg-amber-500" : "bg-green-500";
                      const tierBorder = tierColor === "red" ? "border-red-200" : tierColor === "amber" ? "border-amber-200" : "border-green-200";
                      const tierBgLight = tierColor === "red" ? "bg-red-50" : tierColor === "amber" ? "bg-amber-50" : "bg-green-50";

                      return (
                        <div key={blockId} className="flex flex-col items-center">
                          {/* Connector line from previous block */}
                          {idx > 0 && (
                            <div className="w-0.5 h-3 bg-slate-200" />
                          )}

                          {/* Block card */}
                          <button
                            onClick={() => setSelectedBlockId(isSelected ? null : blockId)}
                            className={cn(
                              "w-full text-left rounded-lg border-2 transition-all",
                              isSelected
                                ? "border-blue-400 bg-blue-50 shadow-sm"
                                : `${tierBorder} ${tierBgLight} hover:shadow-sm`
                            )}
                          >
                            <div className="flex items-center gap-2 px-3 py-2">
                              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold", tierBg)}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-700 text-sm truncate">{block?.name}</div>
                                {variantId !== "default" && (
                                  <div className="text-[10px] text-slate-500">
                                    using <span className="font-medium text-blue-600">{variantId}</span> variant
                                  </div>
                                )}
                              </div>
                              {isSelected ? (
                                <ChevronDown className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              )}
                            </div>

                            {/* Expanded content preview */}
                            {isSelected && (
                              <div className="border-t border-blue-200 bg-slate-900 rounded-b-lg p-3 max-h-32 overflow-auto">
                                <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                                  {assembledPromptParts.find(p => p.blockId === blockId)?.content}
                                </pre>
                              </div>
                            )}
                          </button>

                          {/* Connector line to next block */}
                          {idx < assembledPromptParts.length - 1 && (
                            <div className="w-0.5 h-3 bg-slate-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t text-[10px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Tier 1 (Critical)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Tier 2 (Important)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Tier 3 (Optional)</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-slate-800 mb-4">All Blocks</h3>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {sourceBlocks.map(block => {
                    const variantCount = Object.keys(block.variants).length - 1; // exclude default
                    return (
                      <div
                        key={block.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            block.tier === 1 ? "bg-red-500" :
                            block.tier === 2 ? "bg-amber-500" : "bg-green-500"
                          )} />
                          <span className="text-sm text-slate-700">{block.name}</span>
                        </div>
                        {variantCount > 0 && (
                          <span className="text-xs text-slate-400">
                            {variantCount} variant{variantCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick action */}
        <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-800">Ready to edit?</div>
            <div className="text-sm text-slate-500">Open the builder to modify blocks and variants</div>
          </div>
          <button
            onClick={() => {
              // This will be handled by parent - for now just indicate intent
              const event = new CustomEvent('navigate-tab', { detail: 'builder' });
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Open Builder <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
