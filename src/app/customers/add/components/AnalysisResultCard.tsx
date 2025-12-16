"use client";

import { styles } from "./styles";
import { AnalysisResult, TransparencyData } from "./types";

type AnalysisResultCardProps = {
  analysisResult: AnalysisResult;
  analyzeTransparency: TransparencyData | null;
  isBuilding: boolean;
  onBuild: (forUpdate?: { profileId: string }) => void;
  onCancel: () => void;
  onViewPrompt: () => void;
};

export default function AnalysisResultCard({
  analysisResult,
  analyzeTransparency,
  isBuilding,
  onBuild,
  onCancel,
  onViewPrompt,
}: AnalysisResultCardProps) {
  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Analysis Result</h3>
      <p style={{ color: "#475569", marginBottom: "12px" }}>
        {analysisResult.sourcePreview}
      </p>

      {analysisResult.urlAlreadyUsed && (
        <div
          style={{
            backgroundColor: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "12px",
          }}
        >
          <strong style={{ color: "#92400e" }}>⚠️ URLs Already Used</strong>
          <p style={{ color: "#78350f", fontSize: "14px", margin: "4px 0 0" }}>
            These URLs were previously used to build &quot;
            {analysisResult.urlAlreadyUsed.profileName}&quot;.
          </p>
        </div>
      )}

      <div
        style={{
          backgroundColor:
            analysisResult.suggestion.action === "create_new"
              ? "#dcfce7"
              : "#e0e7ff",
          border: `1px solid ${analysisResult.suggestion.action === "create_new" ? "#86efac" : "#a5b4fc"}`,
          borderRadius: "6px",
          padding: "12px",
          marginBottom: "12px",
        }}
      >
        <strong
          style={{
            color:
              analysisResult.suggestion.action === "create_new"
                ? "#166534"
                : "#3730a3",
          }}
        >
          {analysisResult.suggestion.action === "create_new"
            ? "✨ Create New Profile"
            : "📝 Update Existing Profile"}
        </strong>
        {analysisResult.suggestion.suggestedName && (
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
            {analysisResult.suggestion.suggestedName}
          </p>
        )}
        <p style={{ color: "#475569", fontSize: "14px", margin: "4px 0 0" }}>
          {analysisResult.suggestion.reason}
        </p>
      </div>

      <div style={{ display: "flex", gap: "8px", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={() =>
              onBuild(
                analysisResult.suggestion.existingProfileId
                  ? { profileId: analysisResult.suggestion.existingProfileId }
                  : undefined
              )
            }
            disabled={isBuilding}
          >
            {isBuilding ? (
              <>Building...</>
            ) : analysisResult.suggestion.action === "create_new" ? (
              "Build Profile"
            ) : (
              "Update Profile"
            )}
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={onCancel}
            disabled={isBuilding}
          >
            Cancel
          </button>
        </div>
        {analyzeTransparency && (
          <button
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              fontSize: "12px",
              padding: "6px 10px",
            }}
            onClick={onViewPrompt}
          >
            View Prompt
          </button>
        )}
      </div>
    </div>
  );
}
