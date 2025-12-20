"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { ConversationalPanel, Message } from "@/components/ui/conversational-panel";
import { STARTER_TEMPLATES } from "./types";

type PresetDraft = {
  name: string;
  description: string;
  content: string;
};

export function BuilderTab({ onPresetSaved }: { onPresetSaved: () => void }) {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: `Hi! I'm here to help you create a custom AI assistant persona.

What kind of assistant would you like to build? You can pick a template to get started, or describe your own:`,
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState<PresetDraft>({ name: "", description: "", content: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Resizable panel
  const {
    panelWidth,
    isDragging,
    containerRef,
    handleMouseDown,
  } = useResizablePanel({
    storageKey: "admin-personas-builder-panel-width",
    defaultWidth: 400,
    minWidth: 300,
    maxWidth: 600,
  });

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/instruction-presets/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          currentDraft: draft,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.data.message }]);
        if (data.data.draft) {
          setDraft(data.data.draft);
        }
      }
    } catch (error) {
      console.error("Builder error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateClick = (prompt: string) => {
    setInput(prompt);
    // Trigger send after setting input
    setTimeout(() => {
      const sendBtn = document.querySelector('[data-send-btn]') as HTMLButtonElement;
      sendBtn?.click();
    }, 0);
  };

  const handleSave = async () => {
    if (!draft.name || !draft.content) return;
    setIsSaving(true);
    try {
      await fetch("/api/instruction-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          content: draft.content,
          requestShare: false,
        }),
      });
      onPresetSaved();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden">
      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col">
          {/* Starter templates */}
          {messages.length <= 1 && (
            <div className="p-4 border-b bg-slate-50">
              <p className="text-sm text-slate-600 mb-3">Quick start with a template:</p>
              <div className="flex flex-wrap gap-2">
                {STARTER_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateClick(t.prompt)}
                    className="text-left px-3 py-2 rounded-lg border bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-sm font-medium text-slate-700">{t.label}</div>
                    <div className="text-xs text-slate-500">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <ConversationalPanel
            messages={messages}
            isLoading={isLoading}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            placeholder="Describe the persona you want to create..."
          />
        </div>
      </div>

      {/* Resizable divider */}
      <ResizableDivider onMouseDown={handleMouseDown} isDragging={isDragging} />

      {/* Preview panel */}
      <div style={{ width: panelWidth }} className="flex-shrink-0 flex flex-col overflow-hidden bg-slate-50 border-l">
        <div className="p-4 border-b bg-white">
          <h3 className="font-semibold text-slate-800">Persona Preview</h3>
          <p className="text-xs text-slate-500">Built from your conversation</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Name</label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Persona name"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Description</label>
            <Input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Brief description"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Instructions</label>
            <textarea
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              placeholder="The AI instructions will appear here as you build..."
              className="w-full h-48 p-3 border rounded-lg text-sm font-mono resize-none"
            />
          </div>
        </div>
        <div className="p-4 border-t bg-white">
          <Button
            onClick={handleSave}
            disabled={!draft.name || !draft.content || isSaving}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save Persona"}
          </Button>
        </div>
      </div>
    </div>
  );
}
