"use client";

import { styles } from "./styles";
import { SalesforceEnrichment } from "./types";

type SalesforceEnrichmentCardProps = {
  enrichment: SalesforceEnrichment;
  onApply: () => void;
  onCancel: () => void;
};

export default function SalesforceEnrichmentCard({
  enrichment,
  onApply,
  onCancel,
}: SalesforceEnrichmentCardProps) {
  return (
    <div style={styles.card}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <span style={{
          backgroundColor: "#e0f2fe",
          color: "#0369a1",
          padding: "4px 10px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: 600,
        }}>
          Salesforce
        </span>
        <h3 style={{ margin: 0 }}>Import Preview</h3>
      </div>

      <div style={{ backgroundColor: "#f8fafc", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
        <h4 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>{enrichment.name}</h4>
        {enrichment.industry && (
          <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#64748b" }}>
            <strong>Industry:</strong> {enrichment.industry}
          </p>
        )}
        {enrichment.website && (
          <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#64748b" }}>
            <strong>Website:</strong> {enrichment.website}
          </p>
        )}
        <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#475569" }}>
          {enrichment.overview}
        </p>

        {enrichment.keyFacts.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <strong style={{ fontSize: "13px", color: "#64748b" }}>Key Facts:</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {enrichment.keyFacts.map((fact, idx) => (
                <span key={idx} style={{
                  backgroundColor: "#e0e7ff",
                  color: "#4338ca",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}>
                  {fact.label}: {fact.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={onApply}
        >
          Use This Data
        </button>
        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "12px" }}>
        This will create a draft profile. You can edit all fields before saving, or add URLs/documents to enrich further.
      </p>
    </div>
  );
}
