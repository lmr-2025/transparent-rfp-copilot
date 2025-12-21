"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { InlineError } from "@/components/ui/status-display";
import { useApiQuery } from "@/hooks/use-api";
import { CONFIDENCE_COLORS, formatPercent } from "./constants";
import type { AccuracyData } from "./types";

type DashboardTabProps = {
  days: number;
  onDaysChange: (days: number) => void;
};

export default function DashboardTab({ days, onDaysChange }: DashboardTabProps) {
  const [expandedCorrection, setExpandedCorrection] = useState<string | null>(null);

  const {
    data,
    isLoading: loading,
    error: accuracyError,
    refetch: fetchData,
  } = useApiQuery<AccuracyData>({
    queryKey: ["accuracy-stats", days],
    url: "/api/accuracy/stats",
    params: { days },
  });

  const error = accuracyError?.message || null;
  const maxDaily = data?.daily?.reduce((max, d) => Math.max(max, d.total), 0) || 1;

  return (
    <>
      {/* Controls */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <select
          value={days}
          onChange={(e) => onDaysChange(Number(e.target.value))}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            background: "white",
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>

        <button
          onClick={() => fetchData()}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: "#0ea5e9",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          Loading accuracy data...
        </div>
      )}

      {error && (
        <div style={{ marginBottom: "24px" }}>
          <InlineError message={error} />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Overall Accuracy
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: data.summary.overallAccuracy && data.summary.overallAccuracy >= 90 ? "#16a34a" : "#eab308",
                }}
              >
                {formatPercent(data.summary.overallAccuracy)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                {data.summary.totalAnswers - data.summary.totalCorrected} / {data.summary.totalAnswers} uncorrected
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Total Answers
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>
                {data.summary.totalAnswers.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Last {days} days
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Corrections Made
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#dc2626" }}>
                {data.summary.totalCorrected}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Answers that needed fixing
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Flagged for Attention
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f59e0b" }}>
                {data.summary.flaggedCount}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Self-flagged answers
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "4px" }}>
                Reviews Pending
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0ea5e9" }}>
                {data.summary.reviewsPending}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Awaiting review
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            {/* Confidence Distribution */}
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Confidence Distribution</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(["High", "Medium", "Low", "Unknown"] as const).map((level) => {
                  const count = data.confidenceDistribution[level];
                  const total = Object.values(data.confidenceDistribution).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={level}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.875rem", color: CONFIDENCE_COLORS[level], fontWeight: 500 }}>
                          {level}
                        </span>
                        <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                          {count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: CONFIDENCE_COLORS[level],
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Correction Rate by Confidence */}
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Correction Rate by Confidence</h3>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "16px" }}>
                How often each confidence level needs correction
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {data.correctionRates.filter(r => r.total > 0).map((rate) => (
                  <div key={rate.confidence}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                        {rate.confidence}
                      </span>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: rate.correctionRate && rate.correctionRate > 20 ? "#dc2626" :
                                 rate.correctionRate && rate.correctionRate > 10 ? "#eab308" : "#16a34a",
                        }}
                      >
                        {formatPercent(rate.correctionRate)} corrected
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {rate.corrected} of {rate.total} answers
                    </div>
                  </div>
                ))}
              </div>
              {data.correctionRates.some(r => r.confidence === "High" && r.correctionRate && r.correctionRate > 5) && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    background: "#fef3c7",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    color: "#92400e",
                  }}
                >
                  High confidence answers are being corrected frequently - review your knowledge base.
                </div>
              )}
            </div>
          </div>

          {/* Daily Trend */}
          <div
            style={{
              padding: "24px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              marginBottom: "32px",
            }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Answer Volume & Corrections Over Time</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "120px" }}>
              {data.daily.slice(-30).map((day) => {
                const height = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
                const correctedHeight = maxDaily > 0 ? (day.corrected / maxDaily) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      height: "100%",
                      position: "relative",
                    }}
                    title={`${day.date}: ${day.total} answers, ${day.corrected} corrected`}
                  >
                    {/* Corrected portion */}
                    <div
                      style={{
                        width: "100%",
                        height: `${correctedHeight}px`,
                        minHeight: day.corrected > 0 ? "2px" : "0px",
                        background: "#dc2626",
                        position: "absolute",
                        bottom: 0,
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                    {/* Total bar */}
                    <div
                      style={{
                        width: "100%",
                        height: `${height}px`,
                        minHeight: day.total > 0 ? "4px" : "0px",
                        background: "#e2e8f0",
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
                fontSize: "0.75rem",
                color: "#94a3b8",
              }}
            >
              <span>{data.daily[0]?.date || ""}</span>
              <span>
                <span style={{ color: "#e2e8f0", background: "#e2e8f0", padding: "0 4px", borderRadius: "2px" }}>__</span> Total{" "}
                <span style={{ color: "#dc2626", background: "#dc2626", padding: "0 4px", borderRadius: "2px", marginLeft: "8px" }}>__</span> Corrected
              </span>
              <span>{data.daily[data.daily.length - 1]?.date || ""}</span>
            </div>
          </div>

          {/* Skills Needing Attention */}
          {data.skillsNeedingAttention.length > 0 && (
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #fecaca",
                marginBottom: "32px",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: "8px", color: "#dc2626" }}>
                Skills Needing Attention
              </h3>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "16px" }}>
                These skills have high correction rates - consider updating their content
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.skillsNeedingAttention.map((skill) => (
                  <div
                    key={skill.skillId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px",
                      background: "#fef2f2",
                      borderRadius: "6px",
                    }}
                  >
                    <Link
                      href={`/knowledge?edit=${skill.skillId}`}
                      style={{ color: "#1e293b", fontWeight: 500, textDecoration: "none" }}
                    >
                      {skill.title}
                    </Link>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#dc2626", fontWeight: 600 }}>
                        {skill.correctionRate.toFixed(0)}% correction rate
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {skill.corrections} of {skill.total} uses
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Corrections */}
          <div
            style={{
              padding: "24px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>
              Recent Corrections
              <span style={{ fontWeight: 400, fontSize: "0.875rem", color: "#64748b", marginLeft: "8px" }}>
                (learn from mistakes)
              </span>
            </h3>
            {data.recentCorrections.length === 0 ? (
              <div style={{ color: "#94a3b8", padding: "20px", textAlign: "center" }}>
                No corrections yet - great job!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {data.recentCorrections.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "16px",
                      background: "#fef2f2",
                      borderRadius: "8px",
                      border: "1px solid #fecaca",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      {item.project ? (
                        <Link
                          href={`/projects/${item.project.id}`}
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            textDecoration: "none",
                          }}
                        >
                          {item.project.name}
                        </Link>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Quick Question</span>
                      )}
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : ""}
                        {item.reviewedBy && ` by ${item.reviewedBy}`}
                      </span>
                    </div>
                    <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                      Q: {item.question.length > 150 ? item.question.slice(0, 150) + "..." : item.question}
                    </div>
                    {expandedCorrection === item.id ? (
                      <>
                        <div style={{ marginBottom: "8px" }}>
                          <div style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 500, marginBottom: "4px" }}>
                            Original Answer:
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", whiteSpace: "pre-wrap" }}>
                            {item.response}
                          </div>
                        </div>
                        {item.userEditedAnswer && (
                          <div style={{ marginBottom: "8px" }}>
                            <div style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 500, marginBottom: "4px" }}>
                              Corrected Answer:
                            </div>
                            <div style={{ fontSize: "0.875rem", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                              {item.userEditedAnswer}
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "16px", fontSize: "0.75rem", color: "#94a3b8" }}>
                          {item.confidence && <span>Confidence: {item.confidence}</span>}
                          {item.usedSkills && item.usedSkills.length > 0 && (
                            <span>Skills: {item.usedSkills.map((s) => s.title).join(", ")}</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                        {item.response.length > 100 ? item.response.slice(0, 100) + "..." : item.response}
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedCorrection(expandedCorrection === item.id ? null : item.id)}
                      style={{
                        marginTop: "8px",
                        padding: "4px 8px",
                        fontSize: "0.75rem",
                        background: "transparent",
                        border: "1px solid #e2e8f0",
                        borderRadius: "4px",
                        cursor: "pointer",
                        color: "#64748b",
                      }}
                    >
                      {expandedCorrection === item.id ? "Show Less" : "Show More"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
