"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link as LinkIcon, Loader2, Upload, X, PenLine, MessageSquare, Send, HelpCircle, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { parseApiData, getApiErrorMessage } from "@/lib/apiClient";
import { createSkillViaApi } from "@/lib/skillStorage";
import { type DocumentSource } from "@/stores/bulk-import-store";
import { styles } from "./styles";

interface ClarifyMessage {
  role: 'user' | 'assistant';
  content: string;
}

type InputMode = "urls" | "documents" | "manual";

type SourceInputStepProps = {
  urlInput: string;
  setUrlInput: (value: string) => void;
  uploadedDocuments: DocumentSource[];
  addUploadedDocument: (doc: DocumentSource) => void;
  removeUploadedDocument: (id: string) => void;
  onStartAnalysis: () => void;
  parsedUrls: string[];
};

export default function SourceInputStep({
  urlInput,
  setUrlInput,
  uploadedDocuments,
  addUploadedDocument,
  removeUploadedDocument,
  onStartAnalysis,
  parsedUrls,
}: SourceInputStepProps) {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<InputMode>("urls");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual skill creation state
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Clarify conversation state
  const [showClarify, setShowClarify] = useState(false);
  const [clarifyMessages, setClarifyMessages] = useState<ClarifyMessage[]>([]);
  const [clarifyInput, setClarifyInput] = useState("");
  const [isClarifying, setIsClarifying] = useState(false);
  const clarifyEndRef = useRef<HTMLDivElement>(null);

  // Help/guide state
  const [showGuide, setShowGuide] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        formData.append("title", nameWithoutExt);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        const json = await response.json();

        if (!response.ok) {
          throw new Error(getApiErrorMessage(json, `Failed to upload ${file.name}`));
        }

        const doc = parseApiData<{ id: string; title: string; filename: string; content: string }>(json, "document");
        addUploadedDocument({
          id: doc.id,
          title: doc.title,
          filename: doc.filename,
          content: doc.content,
        });
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : `Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveManualSkill = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) {
      setManualError("Title and content are required");
      return;
    }

    setIsSavingManual(true);
    setManualError(null);

    try {
      const now = new Date().toISOString();
      const skillData = {
        title: manualTitle.trim(),
        content: manualContent.trim(),
        quickFacts: [] as { question: string; answer: string }[],
        edgeCases: [] as string[],
        sourceUrls: [],
        isActive: true,
        tier: "library" as const,
        history: [
          {
            date: now,
            action: "created" as const,
            summary: "Created manually",
          },
        ],
      };

      await createSkillViaApi(skillData);
      toast.success(`Skill "${manualTitle.trim()}" created successfully`);

      // Navigate to knowledge library
      router.push("/knowledge");
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Failed to create skill");
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleClarifySubmit = async () => {
    if (!clarifyInput.trim() || isClarifying) return;

    const userMessage: ClarifyMessage = { role: 'user', content: clarifyInput.trim() };
    setClarifyMessages(prev => [...prev, userMessage]);
    setClarifyInput("");
    setIsClarifying(true);

    try {
      const systemPrompt = `You are helping a user create a knowledge skill for an RFP/security questionnaire assistant.

Current skill being created:
- Title: "${manualTitle || '(not yet set)'}"
- Content: "${manualContent || '(not yet set)'}"

The user is asking for help refining this skill. Your role is to:
1. Help them improve the title to be clear and searchable
2. Help them write accurate, factual content
3. Suggest corrections if they mention something that seems incorrect
4. Help structure the content for clarity
5. If they provide raw information, help them format it as a proper skill

IMPORTANT: Do NOT hallucinate or make up facts. If you're unsure about something, ask the user to verify. If they're stating industry facts (like "SOC 2 is an attestation not a certification"), help them phrase it clearly.

When suggesting updated content, format it clearly so they can copy it.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          messages: [
            ...clarifyMessages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: clarifyInput.trim() },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const json = await response.json();
      const content = parseApiData<{ type: string; text?: string }[]>(json, "content");
      const assistantContent = (content || [])
        .filter(block => block.type === 'text')
        .map(block => block.text ?? '')
        .join('\n');

      setClarifyMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);

      // Scroll to bottom
      setTimeout(() => clarifyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      setClarifyMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
      }]);
    } finally {
      setIsClarifying(false);
    }
  };

  const canAnalyze = parsedUrls.length > 0 || uploadedDocuments.length > 0;
  const canSaveManual = manualTitle.trim().length > 0 && manualContent.trim().length > 0;

  return (
    <div style={styles.card}>
      {/* Help Guide Section */}
      <div style={{ marginBottom: "20px", border: "1px solid #e0e7ff", borderRadius: "8px", backgroundColor: "#f0f9ff" }}>
        <button
          onClick={() => setShowGuide(!showGuide)}
          style={{
            width: "100%",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#1e40af",
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <HelpCircle size={18} />
            <span>How to Add Knowledge Sources</span>
          </div>
          {showGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showGuide && (
          <div style={{ padding: "0 16px 16px", fontSize: "14px", color: "#1e293b", lineHeight: "1.6" }}>
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#1e40af", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Overview
              </h4>
              <p style={{ margin: 0, color: "#475569" }}>
                The AI-powered bulk import system analyzes your sources, automatically groups related content,
                and suggests whether to create new skills or update existing ones. It includes smart conflict
                detection to ensure source quality.
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#1e40af", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                The Process
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600 }}>1</div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Add Sources:</strong> Paste URLs or upload documents (PDFs, Word, etc.)
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600 }}>2</div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>AI Grouping:</strong> The system analyzes content and groups by topic similarity
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600 }}>3</div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Conflict Detection:</strong> Automatic checks for content discrepancies and source conflicts
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600 }}>4</div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Review & Adjust:</strong> Approve groups, split conflicts, or move sources between groups
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600 }}>5</div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Generate & Review:</strong> AI creates skill drafts from approved groups
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#1e40af", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Conflict Detection Explained
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "start" }}>
                  <AlertCircle size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ color: "#92400e" }}>Content Discrepancy (UPDATE groups):</strong>
                    <span style={{ color: "#475569" }}> Compares new source URL against existing skill content to show what changed</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "start" }}>
                  <AlertCircle size={16} style={{ color: "#dc2626", flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ color: "#7f1d1d" }}>Source Conflicts (all groups):</strong>
                    <span style={{ color: "#475569" }}> Detects when sources within a group contradict each other (technical conflicts, version mismatches, scope differences)</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#10b981", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle size={16} />
                Best Practices
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#475569", fontSize: "13px", lineHeight: "1.8" }}>
                <li><strong>Group related content:</strong> Add URLs/docs that cover the same topic or feature together</li>
                <li><strong>Use descriptive URLs:</strong> Documentation URLs work better than marketing pages</li>
                <li><strong>Mix sources strategically:</strong> Combine official docs, tutorials, and guides for comprehensive coverage</li>
                <li><strong>Review conflict warnings:</strong> Pay attention to version mismatches (v1 vs v2) and technical contradictions</li>
                <li><strong>Split when needed:</strong> If sources conflict significantly, split them into separate skills</li>
                <li><strong>Add guidance notes:</strong> Use the "Notes for AI" field to specify focus areas (e.g., "focus on security aspects")</li>
                <li><strong>Start small:</strong> Try 3-5 URLs first to understand the flow, then scale up</li>
              </ul>
            </div>

            <div style={{ padding: "12px", backgroundColor: "#fef3c7", border: "1px solid #fde047", borderRadius: "6px", fontSize: "13px" }}>
              <strong style={{ color: "#92400e" }}>💡 Pro Tip:</strong>
              <span style={{ color: "#713f12" }}> Groups with 2-5 sources get automatic coherence analysis. Single sources and large groups (6+) skip this check for performance.</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Mode Tabs */}
      <div style={{ display: "flex", gap: "0", marginBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
        <button
          onClick={() => setInputMode("urls")}
          style={{
            padding: "12px 20px",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: inputMode === "urls" ? "2px solid #2563eb" : "2px solid transparent",
            color: inputMode === "urls" ? "#2563eb" : "#64748b",
            fontWeight: inputMode === "urls" ? 600 : 400,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <LinkIcon size={16} />
          URLs
        </button>
        <button
          onClick={() => setInputMode("documents")}
          style={{
            padding: "12px 20px",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: inputMode === "documents" ? "2px solid #2563eb" : "2px solid transparent",
            color: inputMode === "documents" ? "#2563eb" : "#64748b",
            fontWeight: inputMode === "documents" ? 600 : 400,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FileText size={16} />
          Documents
          {uploadedDocuments.length > 0 && (
            <span style={{
              padding: "2px 8px",
              backgroundColor: "#dbeafe",
              color: "#1e40af",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
            }}>{uploadedDocuments.length}</span>
          )}
        </button>
        <button
          onClick={() => setInputMode("manual")}
          style={{
            padding: "12px 20px",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: inputMode === "manual" ? "2px solid #2563eb" : "2px solid transparent",
            color: inputMode === "manual" ? "#2563eb" : "#64748b",
            fontWeight: inputMode === "manual" ? 600 : 400,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <PenLine size={16} />
          Manual
        </button>
      </div>

      {/* URL Input */}
      {inputMode === "urls" && (
        <>
          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
            Paste one or more URLs (one per line). The AI will analyze them, group related content, and suggest skills to create or update.
          </p>
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://docs.example.com/security&#10;https://docs.example.com/compliance&#10;https://docs.example.com/api/authentication&#10;..."
            style={{
              width: "100%",
              minHeight: "200px",
              padding: "12px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "13px",
              resize: "vertical",
            }}
          />
          <div style={{ marginTop: "8px", color: "#94a3b8", fontSize: "13px" }}>
            {parsedUrls.length} valid URL{parsedUrls.length !== 1 ? "s" : ""}
          </div>
        </>
      )}

      {/* Document Upload */}
      {inputMode === "documents" && (
        <>
          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
            Upload PDF, Word, or text documents. The AI will extract content, analyze it, and suggest skills to create or update.
          </p>

          {uploadError && (
            <div style={{ ...styles.error, marginBottom: "16px" }}>{uploadError}</div>
          )}

          <div
            style={{
              border: "2px dashed #cbd5e1",
              borderRadius: "8px",
              padding: "32px",
              textAlign: "center",
              backgroundColor: "#f8fafc",
              marginBottom: "16px",
              cursor: isUploading ? "not-allowed" : "pointer",
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.pptx,.xlsx,.xls"
              multiple
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            {isUploading ? (
              <>
                <Loader2 size={32} style={{ color: "#64748b", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
                <div style={{ color: "#64748b", fontWeight: 500 }}>Uploading...</div>
              </>
            ) : (
              <>
                <Upload size={32} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
                <div style={{ color: "#475569", fontWeight: 500 }}>
                  Click to upload or drag and drop
                </div>
                <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>
                  PDF, DOC, DOCX, PPTX, XLSX, TXT (max 20MB each)
                </div>
              </>
            )}
          </div>

          {uploadedDocuments.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#475569", marginBottom: "8px" }}>
                {uploadedDocuments.length} document{uploadedDocuments.length !== 1 ? "s" : ""} ready to analyze:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {uploadedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #86efac",
                      borderRadius: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FileText size={16} style={{ color: "#15803d" }} />
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "#166534" }}>
                        {doc.filename}
                      </span>
                    </div>
                    <button
                      onClick={() => removeUploadedDocument(doc.id)}
                      style={{
                        padding: "4px",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#64748b",
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual Skill Input */}
      {inputMode === "manual" && (
        <>
          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
            Create a skill directly by entering a title and content. Use this for quick notes, internal policies, or knowledge that doesn&apos;t come from a URL or document.
          </p>

          {manualError && (
            <div style={{ ...styles.error, marginBottom: "16px" }}>{manualError}</div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#475569", marginBottom: "6px" }}>
              Skill Title
            </label>
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="e.g., SOC 2 Attestation vs Certification"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "14px",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#475569", marginBottom: "6px" }}>
              Content
            </label>
            <textarea
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              placeholder="Enter the knowledge content here. This can include facts, policies, clarifications, or any information you want the AI to reference when answering questions."
              style={{
                width: "100%",
                minHeight: "200px",
                padding: "12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "14px",
                resize: "vertical",
                lineHeight: "1.5",
              }}
            />
          </div>

          {/* Clarify with AI Section */}
          <div style={{ marginBottom: "16px" }}>
            <button
              onClick={() => setShowClarify(!showClarify)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                backgroundColor: showClarify ? "#dbeafe" : "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
                color: showClarify ? "#1e40af" : "#475569",
              }}
            >
              <MessageSquare size={16} />
              {showClarify ? "Hide AI Assistant" : "Get Help from AI"}
            </button>

            {showClarify && (
              <div style={{
                marginTop: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "10px 12px",
                  backgroundColor: "#0ea5e9",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                }}>
                  AI Assistant - Help refine your skill
                </div>

                {/* Messages */}
                <div style={{
                  padding: "12px",
                  maxHeight: "300px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}>
                  {clarifyMessages.length === 0 && (
                    <div style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic" }}>
                      Ask the AI for help writing your skill content. For example:
                      <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                        <li>&quot;Help me explain that SOC 2 is an attestation, not a certification&quot;</li>
                        <li>&quot;Is this content accurate?&quot;</li>
                        <li>&quot;Can you suggest a better title?&quot;</li>
                      </ul>
                    </div>
                  )}
                  {clarifyMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        maxWidth: "100%",
                        backgroundColor: msg.role === 'user' ? "#0ea5e9" : "#fff",
                        color: msg.role === 'user' ? "#fff" : "#0f172a",
                        border: msg.role === 'assistant' ? "1px solid #e2e8f0" : "none",
                        alignSelf: msg.role === 'user' ? "flex-end" : "flex-start",
                      }}
                    >
                      <div style={{ whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: "1.5" }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isClarifying && (
                    <div style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                      <span style={{ color: "#64748b", fontSize: "13px" }}>Thinking...</span>
                    </div>
                  )}
                  <div ref={clarifyEndRef} />
                </div>

                {/* Input */}
                <div style={{
                  padding: "10px 12px",
                  borderTop: "1px solid #e2e8f0",
                  backgroundColor: "#fff",
                  display: "flex",
                  gap: "8px",
                }}>
                  <input
                    type="text"
                    value={clarifyInput}
                    onChange={(e) => setClarifyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleClarifySubmit();
                      }
                    }}
                    placeholder="Ask the AI for help..."
                    disabled={isClarifying}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                  />
                  <button
                    onClick={handleClarifySubmit}
                    disabled={!clarifyInput.trim() || isClarifying}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: clarifyInput.trim() && !isClarifying ? "#0ea5e9" : "#cbd5e1",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: clarifyInput.trim() && !isClarifying ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: "16px",
            borderTop: "1px solid #e2e8f0",
          }}>
            <button
              onClick={handleSaveManualSkill}
              disabled={!canSaveManual || isSavingManual}
              style={{
                padding: "10px 20px",
                backgroundColor: canSaveManual && !isSavingManual ? "#2563eb" : "#cbd5e1",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: canSaveManual && !isSavingManual ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {isSavingManual && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
              {isSavingManual ? "Saving..." : "Create Skill"}
            </button>
          </div>
        </>
      )}

      {/* Summary & Analyze Button (only for URLs and Documents modes) */}
      {inputMode !== "manual" && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid #e2e8f0",
        }}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            {parsedUrls.length > 0 && `${parsedUrls.length} URL${parsedUrls.length !== 1 ? "s" : ""}`}
            {parsedUrls.length > 0 && uploadedDocuments.length > 0 && " + "}
            {uploadedDocuments.length > 0 && `${uploadedDocuments.length} document${uploadedDocuments.length !== 1 ? "s" : ""}`}
            {parsedUrls.length === 0 && uploadedDocuments.length === 0 && "Add URLs or documents to analyze"}
          </div>
          <button
            onClick={onStartAnalysis}
            disabled={!canAnalyze}
            style={{
              padding: "10px 20px",
              backgroundColor: canAnalyze ? "#2563eb" : "#cbd5e1",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: canAnalyze ? "pointer" : "not-allowed",
            }}
          >
            Analyze Sources →
          </button>
        </div>
      )}
    </div>
  );
}
