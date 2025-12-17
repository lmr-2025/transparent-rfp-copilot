"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Skill } from "@/types/skill";
import { loadSkillsFromStorage, loadSkillsFromApi, createSkillViaApi, updateSkillViaApi } from "@/lib/skillStorage";
import { parseApiData } from "@/lib/apiClient";

import {
  ColumnMappingStep,
  PreviewAnalyzeStep,
  SuggestionsReviewStep,
  SkillLibraryInfo,
  styles,
  RFPEntry,
  AnalysisResult,
} from "./components";

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

  // Load skills from API on mount
  useEffect(() => {
    loadSkillsFromApi().then(setSkills).catch(() => toast.error("Failed to load skills"));
  }, []);

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

      const firstRow = data[0];
      const headers = (Array.isArray(firstRow) ? firstRow : []).map((h) => String(h || "").trim());
      setColumns(headers.filter(Boolean));

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
            content: s.content,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Analysis failed");
      }

      const json = await response.json();
      const result = parseApiData<AnalysisResult>(json);
      setAnalysisResult(result);
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

  const toggleAllSuggestions = () => {
    if (!analysisResult) return;
    if (selectedSuggestions.size === analysisResult.suggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(analysisResult.suggestions.map((_, i) => i)));
    }
  };

  const handleApplySelected = async () => {
    if (!analysisResult || selectedSuggestions.size === 0) return;

    let updatesApplied = 0;
    let newSkillsCreated = 0;
    const updatedSkillsList: Skill[] = [];
    const newSkillsList: Skill[] = [];

    for (const [index, suggestion] of analysisResult.suggestions.entries()) {
      if (!selectedSuggestions.has(index)) continue;

      try {
        if (suggestion.type === "update" && suggestion.skillId) {
          const existingSkill = skills.find((s) => s.id === suggestion.skillId);
          if (existingSkill) {
            const updates = {
              content: existingSkill.content + "\n\n" + suggestion.suggestedAdditions,
              lastRefreshedAt: new Date().toISOString(),
            };
            const updatedSkill = await updateSkillViaApi(suggestion.skillId, updates);
            updatedSkillsList.push(updatedSkill);
            updatesApplied++;
          }
        } else if (suggestion.type === "new") {
          const skillData = {
            title: suggestion.skillTitle,
            content: suggestion.suggestedAdditions,
            quickFacts: [] as { question: string; answer: string }[],
            edgeCases: [] as string[],
            sourceUrls: [] as { url: string; addedAt: string; lastFetchedAt?: string }[],
            isActive: true,
          };
          const newSkill = await createSkillViaApi(skillData);
          newSkillsList.push(newSkill);
          newSkillsCreated++;
        }
      } catch {
        toast.error("Failed to apply suggestion");
      }
    }

    setSkills((prev) => {
      const updated = prev.map((s) => {
        const updatedVersion = updatedSkillsList.find((u) => u.id === s.id);
        return updatedVersion || s;
      });
      return [...newSkillsList, ...updated];
    });

    setSuccessMessage(
      `Applied ${updatesApplied} skill update${updatesApplied !== 1 ? "s" : ""} and created ${newSkillsCreated} new skill${newSkillsCreated !== 1 ? "s" : ""}.`
    );
    setAnalysisResult(null);
    setRfpEntries([]);
    setFileName("");
  };

  const handleCancelAnalysis = () => {
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
      <h1>Knowledge Gremlin <span style={{ fontWeight: 400, fontSize: "0.6em", color: "#64748b" }}>(Import from Docs)</span></h1>
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
        <ColumnMappingStep
          columns={columns}
          questionColumn={questionColumn}
          answerColumn={answerColumn}
          onSetQuestionColumn={setQuestionColumn}
          onSetAnswerColumn={setAnswerColumn}
          onExtract={handleColumnMapping}
        />
      )}

      {/* Step 3: Preview & Analyze */}
      {rfpEntries.length > 0 && !analysisResult && (
        <PreviewAnalyzeStep
          rfpEntries={rfpEntries}
          skillsCount={skills.length}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyze}
        />
      )}

      {/* Step 4: Review Suggestions */}
      {analysisResult && (
        <SuggestionsReviewStep
          analysisResult={analysisResult}
          selectedSuggestions={selectedSuggestions}
          updateCount={updateCount}
          newCount={newCount}
          onToggleSuggestion={toggleSuggestion}
          onToggleAll={toggleAllSuggestions}
          onApply={handleApplySelected}
          onCancel={handleCancelAnalysis}
        />
      )}

      {/* Info about existing skills */}
      <SkillLibraryInfo skills={skills} />
    </div>
  );
}
