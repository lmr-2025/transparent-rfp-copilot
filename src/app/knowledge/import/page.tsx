"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Skill } from "@/types/skill";
import { loadSkillsFromStorage, saveSkillsToStorage } from "@/lib/skillStorage";

type RFPEntry = {
  question: string;
  answer: string;
  source?: string;
};

type SkillSuggestion = {
  type: "update" | "new";
  skillId?: string; // For updates
  skillTitle: string;
  currentContent?: string; // For updates - show what exists
  suggestedAdditions: string; // New content to add
  relevantQA: RFPEntry[]; // The Q&A pairs that informed this suggestion
  tags: string[];
};

type AnalysisResult = {
  suggestions: SkillSuggestion[];
  unmatchedEntries: RFPEntry[];
};

const styles = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "20px",
    backgroundColor: "#fff",
  },
  button: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    cursor: "pointer",
  },
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
};

export default function ImportRFPPage() {
  const [skills, setSkills] = useState<Skill[]>(() => loadSkillsFromStorage());
  const [rfpEntries, setRfpEntries] = useState<RFPEntry[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  // Column mapping state
  const [columns, setColumns] = useState<string[]>([]);
  const [questionColumn, setQuestionColumn] = useState("");
  const [answerColumn, setAnswerColumn] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setAnalysisResult(null);
    setRfpEntries([]);
    setColumns([]);
    setQuestionColumn("");
    setAnswerColumn("");
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { header: 1 });

      if (data.length < 2) {
        setErrorMessage("File appears to be empty or has no data rows.");
        return;
      }

      // First row is headers
      const firstRow = data[0];
      const headers = (Array.isArray(firstRow) ? firstRow : []).map((h) => String(h || "").trim());
      setColumns(headers.filter(Boolean));

      // Store raw data for later processing
      const rawRows = data.slice(1).map((row) => {
        const rowData: Record<string, string> = {};
        const rowArray = Array.isArray(row) ? row : [];
        headers.forEach((header, idx) => {
          if (header) {
            rowData[header] = String(rowArray[idx] || "").trim();
          }
        });
        return rowData;
      });

      // Store in state for column mapping
      (window as unknown as { _rfpRawRows: Record<string, string>[] })._rfpRawRows = rawRows;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to parse file");
    }
  };

  const handleColumnMapping = () => {
    if (!questionColumn || !answerColumn) {
      setErrorMessage("Please select both question and answer columns.");
      return;
    }

    const rawRows = (window as unknown as { _rfpRawRows: Record<string, string>[] })._rfpRawRows || [];
    const entries: RFPEntry[] = rawRows
      .filter((row) => row[questionColumn] && row[answerColumn])
      .map((row) => ({
        question: row[questionColumn],
        answer: row[answerColumn],
      }));

    if (entries.length === 0) {
      setErrorMessage("No valid Q&A pairs found with the selected columns.");
      return;
    }

    setRfpEntries(entries);
    setErrorMessage(null);
  };

  const handleAnalyze = async () => {
    if (rfpEntries.length === 0) {
      setErrorMessage("No RFP entries to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/skills/analyze-rfp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfpEntries,
          existingSkills: skills.map((s) => ({
            id: s.id,
            title: s.title,
            tags: s.tags,
            content: s.content,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Analysis failed");
      }

      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);
      // Select all suggestions by default
      setSelectedSuggestions(new Set(result.suggestions.map((_, i) => i)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    setSelectedSuggestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleApplySelected = () => {
    if (!analysisResult || selectedSuggestions.size === 0) return;

    const updatedSkills = [...skills];
    let updatesApplied = 0;
    let newSkillsCreated = 0;

    analysisResult.suggestions.forEach((suggestion, index) => {
      if (!selectedSuggestions.has(index)) return;

      if (suggestion.type === "update" && suggestion.skillId) {
        // Find and update existing skill
        const skillIndex = updatedSkills.findIndex((s) => s.id === suggestion.skillId);
        if (skillIndex !== -1) {
          updatedSkills[skillIndex] = {
            ...updatedSkills[skillIndex],
            content: updatedSkills[skillIndex].content + "\n\n" + suggestion.suggestedAdditions,
            lastRefreshedAt: new Date().toISOString(),
          };
          updatesApplied++;
        }
      } else if (suggestion.type === "new") {
        // Create new skill
        const newSkill: Skill = {
          id: crypto.randomUUID(),
          title: suggestion.skillTitle,
          tags: suggestion.tags,
          content: suggestion.suggestedAdditions,
          quickFacts: [],
          edgeCases: [],
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        updatedSkills.unshift(newSkill);
        newSkillsCreated++;
      }
    });

    setSkills(updatedSkills);
    saveSkillsToStorage(updatedSkills);
    setSuccessMessage(
      `Applied ${updatesApplied} skill update${updatesApplied !== 1 ? "s" : ""} and created ${newSkillsCreated} new skill${newSkillsCreated !== 1 ? "s" : ""}.`
    );
    setAnalysisResult(null);
    setRfpEntries([]);
    setFileName("");
  };

  const updateCount = useMemo(() => {
    if (!analysisResult) return 0;
    return analysisResult.suggestions.filter(
      (s, i) => s.type === "update" && selectedSuggestions.has(i)
    ).length;
  }, [analysisResult, selectedSuggestions]);

  const newCount = useMemo(() => {
    if (!analysisResult) return 0;
    return analysisResult.suggestions.filter(
      (s, i) => s.type === "new" && selectedSuggestions.has(i)
    ).length;
  }, [analysisResult, selectedSuggestions]);

  return (
    <div style={styles.container}>
      <h1>Import from RFPs</h1>
      <p style={{ color: "#475569", marginBottom: "24px" }}>
        Upload completed RFP spreadsheets to extract knowledge and enrich your skills library.
        The system will analyze Q&A pairs and suggest updates to existing skills or new skills to create.
      </p>

      {errorMessage && <div style={styles.error}>{errorMessage}</div>}
      {successMessage && <div style={styles.success}>{successMessage}</div>}

      {/* Step 1: File Upload */}
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Step 1: Upload RFP File</h3>
        <p style={{ color: "#64748b", fontSize: "14px" }}>
          Upload an Excel or CSV file containing completed questionnaire responses.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          style={{ marginTop: "12px" }}
        />
        {fileName && (
          <p style={{ color: "#166534", marginTop: "8px", fontWeight: 500 }}>
            Loaded: {fileName}
          </p>
        )}
      </div>

      {/* Step 2: Column Mapping */}
      {columns.length > 0 && !rfpEntries.length && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Step 2: Map Columns</h3>
          <p style={{ color: "#64748b", fontSize: "14px" }}>
            Select which columns contain the questions and answers.
          </p>
          <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
                Question Column
              </label>
              <select
                value={questionColumn}
                onChange={(e) => setQuestionColumn(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <option value="">Select column...</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
                Answer Column
              </label>
              <select
                value={answerColumn}
                onChange={(e) => setAnswerColumn(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <option value="">Select column...</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleColumnMapping}
            disabled={!questionColumn || !answerColumn}
            style={{
              ...styles.button,
              marginTop: "16px",
              backgroundColor: !questionColumn || !answerColumn ? "#cbd5e1" : "#2563eb",
              color: "#fff",
            }}
          >
            Extract Q&A Pairs
          </button>
        </div>
      )}

      {/* Step 3: Preview & Analyze */}
      {rfpEntries.length > 0 && !analysisResult && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Step 3: Review & Analyze</h3>
          <p style={{ color: "#166534", fontWeight: 500, marginBottom: "16px" }}>
            Found {rfpEntries.length} Q&A pairs to analyze against {skills.length} existing skills.
          </p>

          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              marginBottom: "16px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", position: "sticky", top: 0 }}>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                    Question
                  </th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                    Answer (Preview)
                  </th>
                </tr>
              </thead>
              <tbody>
                {rfpEntries.slice(0, 20).map((entry, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #f1f5f9",
                        verticalAlign: "top",
                        maxWidth: "300px",
                      }}
                    >
                      {entry.question.length > 100
                        ? entry.question.substring(0, 100) + "..."
                        : entry.question}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #f1f5f9",
                        verticalAlign: "top",
                        color: "#64748b",
                      }}
                    >
                      {entry.answer.length > 150
                        ? entry.answer.substring(0, 150) + "..."
                        : entry.answer}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rfpEntries.length > 20 && (
              <p style={{ padding: "10px", color: "#64748b", margin: 0, textAlign: "center" }}>
                ...and {rfpEntries.length - 20} more entries
              </p>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            style={{
              ...styles.button,
              backgroundColor: isAnalyzing ? "#94a3b8" : "#2563eb",
              color: "#fff",
            }}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Against Skills"}
          </button>

          {isAnalyzing && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                backgroundColor: "#eff6ff",
                border: "2px solid #60a5fa",
                borderRadius: "8px",
              }}
            >
              <p style={{ margin: 0, color: "#1e40af" }}>
                Analyzing RFP content against your skill library...
                <br />
                <span style={{ fontSize: "13px", color: "#60a5fa" }}>
                  This may take 30-60 seconds depending on the number of entries.
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Review Suggestions */}
      {analysisResult && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Step 4: Review Suggestions</h3>
          <p style={{ color: "#64748b", marginBottom: "16px" }}>
            Select which suggestions to apply. Updates will append content to existing skills.
          </p>

          <div
            style={{
              display: "flex",
              gap: "16px",
              marginBottom: "20px",
              padding: "12px",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
            }}
          >
            <div>
              <span style={{ color: "#0369a1", fontWeight: 600 }}>{updateCount}</span> skill updates
            </div>
            <div>
              <span style={{ color: "#15803d", fontWeight: 600 }}>{newCount}</span> new skills
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={() => {
                  if (selectedSuggestions.size === analysisResult.suggestions.length) {
                    setSelectedSuggestions(new Set());
                  } else {
                    setSelectedSuggestions(new Set(analysisResult.suggestions.map((_, i) => i)));
                  }
                }}
                style={{
                  ...styles.button,
                  padding: "6px 12px",
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                  fontSize: "13px",
                }}
              >
                {selectedSuggestions.size === analysisResult.suggestions.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {analysisResult.suggestions.map((suggestion, index) => (
              <div
                key={index}
                style={{
                  border: `2px solid ${selectedSuggestions.has(index) ? (suggestion.type === "update" ? "#60a5fa" : "#86efac") : "#e2e8f0"}`,
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: selectedSuggestions.has(index)
                    ? suggestion.type === "update"
                      ? "#eff6ff"
                      : "#f0fdf4"
                    : "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(index)}
                    onChange={() => toggleSuggestion(index)}
                    style={{ width: "18px", height: "18px", marginTop: "2px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: suggestion.type === "update" ? "#dbeafe" : "#dcfce7",
                          color: suggestion.type === "update" ? "#1e40af" : "#166534",
                        }}
                      >
                        {suggestion.type === "update" ? "UPDATE" : "NEW"}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "15px" }}>{suggestion.skillTitle}</span>
                    </div>

                    {suggestion.tags.length > 0 && (
                      <div style={{ marginBottom: "8px" }}>
                        {suggestion.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              display: "inline-block",
                              padding: "2px 6px",
                              marginRight: "4px",
                              backgroundColor: "#f1f5f9",
                              borderRadius: "4px",
                              fontSize: "11px",
                              color: "#64748b",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ marginBottom: "12px" }}>
                      <strong style={{ fontSize: "13px", color: "#475569" }}>
                        Content to {suggestion.type === "update" ? "add" : "create"}:
                      </strong>
                      <pre
                        style={{
                          backgroundColor: "#fff",
                          padding: "12px",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                          whiteSpace: "pre-wrap",
                          marginTop: "6px",
                          maxHeight: "200px",
                          overflowY: "auto",
                        }}
                      >
                        {suggestion.suggestedAdditions}
                      </pre>
                    </div>

                    <details style={{ fontSize: "13px", color: "#64748b" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                        Based on {suggestion.relevantQA.length} Q&A pair
                        {suggestion.relevantQA.length !== 1 ? "s" : ""}
                      </summary>
                      <div style={{ marginTop: "8px", paddingLeft: "12px" }}>
                        {suggestion.relevantQA.map((qa, i) => (
                          <div
                            key={i}
                            style={{
                              marginBottom: "8px",
                              paddingBottom: "8px",
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>Q: {qa.question}</div>
                            <div style={{ color: "#94a3b8" }}>
                              A: {qa.answer.length > 200 ? qa.answer.substring(0, 200) + "..." : qa.answer}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {analysisResult.unmatchedEntries.length > 0 && (
            <details style={{ marginTop: "20px" }}>
              <summary style={{ cursor: "pointer", color: "#64748b", fontWeight: 500 }}>
                {analysisResult.unmatchedEntries.length} entries could not be matched to any skill
              </summary>
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "#fef3c7",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              >
                {analysisResult.unmatchedEntries.slice(0, 10).map((entry, i) => (
                  <div key={i} style={{ marginBottom: "8px" }}>
                    <strong>Q:</strong> {entry.question.substring(0, 100)}...
                  </div>
                ))}
                {analysisResult.unmatchedEntries.length > 10 && (
                  <p style={{ color: "#92400e" }}>
                    ...and {analysisResult.unmatchedEntries.length - 10} more
                  </p>
                )}
              </div>
            </details>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <button
              onClick={handleApplySelected}
              disabled={selectedSuggestions.size === 0}
              style={{
                ...styles.button,
                backgroundColor: selectedSuggestions.size === 0 ? "#cbd5e1" : "#15803d",
                color: "#fff",
              }}
            >
              Apply {selectedSuggestions.size} Selected
            </button>
            <button
              onClick={() => {
                setAnalysisResult(null);
                setRfpEntries([]);
                setFileName("");
              }}
              style={{
                ...styles.button,
                backgroundColor: "#f1f5f9",
                color: "#475569",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info about existing skills */}
      <div
        style={{
          ...styles.card,
          backgroundColor: "#f8fafc",
          borderColor: "#e2e8f0",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Current Skill Library</h3>
        <p style={{ color: "#64748b", marginBottom: "12px" }}>
          You have <strong>{skills.length}</strong> skills in your library.
          RFP content will be matched against these to suggest updates.
        </p>
        {skills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {skills.slice(0, 10).map((skill) => (
              <span
                key={skill.id}
                style={{
                  padding: "4px 10px",
                  backgroundColor: skill.isActive ? "#dbeafe" : "#f1f5f9",
                  color: skill.isActive ? "#1e40af" : "#94a3b8",
                  borderRadius: "4px",
                  fontSize: "13px",
                }}
              >
                {skill.title}
              </span>
            ))}
            {skills.length > 10 && (
              <span style={{ color: "#94a3b8", fontSize: "13px", padding: "4px" }}>
                +{skills.length - 10} more
              </span>
            )}
          </div>
        )}
        {skills.length === 0 && (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            No skills yet.{" "}
            <a href="/knowledge" style={{ color: "#2563eb" }}>
              Create some skills first
            </a>{" "}
            to get the most out of RFP import.
          </p>
        )}
      </div>
    </div>
  );
}
