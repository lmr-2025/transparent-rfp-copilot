"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type UsageSummary = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  callCount: number;
};

type FeatureUsage = {
  feature: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  callCount: number;
};

type DailyUsage = {
  date: string;
  tokens: number;
  cost: number;
  calls: number;
};

type RecentCall = {
  id: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: string;
  userEmail?: string;
};

type UsageData = {
  summary: UsageSummary;
  byFeature: FeatureUsage[];
  daily: DailyUsage[];
  recentCalls: RecentCall[];
};

const FEATURE_LABELS: Record<string, string> = {
  questions: "Quick Questions",
  chat: "The Oracle (Chat)",
  "skills-suggest": "Knowledge Gremlin (Skills)",
  "customers-suggest": "The Rolodex (Customers)",
  "contracts-analyze": "Clause Checker (Contracts)",
  projects: "Project Answerer",
};

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export default function UsagePage() {
  useSession(); // Check auth status
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<"user" | "all">("all");

  const fetchUsageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage?days=${days}&scope=${scope}`);
      if (!res.ok) throw new Error("Failed to fetch usage data");
      const data = await res.json();
      setUsageData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days, scope]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  // Calculate max for bar charts
  const maxTokens = usageData?.byFeature.reduce(
    (max, f) => Math.max(max, f.totalTokens),
    0
  ) || 1;

  const maxDailyTokens = usageData?.daily.reduce(
    (max, d) => Math.max(max, d.tokens),
    0
  ) || 1;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "8px" }}>
          API Usage Dashboard
        </h1>
        <p style={{ color: "#64748b" }}>
          Monitor Claude API token usage and estimated costs
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
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

        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "user" | "all")}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            background: "white",
          }}
        >
          <option value="all">All Users</option>
          <option value="user">My Usage Only</option>
        </select>

        <button
          onClick={fetchUsageData}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: "#0ea5e9",
            color: "white",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          Loading usage data...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "16px",
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          {error}
        </div>
      )}

      {!loading && usageData && (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
                Total Tokens
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>
                {formatTokens(usageData.summary.totalTokens)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                {formatTokens(usageData.summary.totalInputTokens)} in / {formatTokens(usageData.summary.totalOutputTokens)} out
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
                Estimated Cost
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#16a34a" }}>
                {formatCost(usageData.summary.totalCost)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Based on current pricing
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
                API Calls
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>
                {usageData.summary.callCount.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                {(usageData.summary.totalTokens / Math.max(usageData.summary.callCount, 1)).toFixed(0)} avg tokens/call
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
                Avg Cost/Call
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700 }}>
                {formatCost(usageData.summary.totalCost / Math.max(usageData.summary.callCount, 1))}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Per API request
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            {/* Usage by Feature */}
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Usage by Feature</h3>
              {usageData.byFeature.length === 0 ? (
                <div style={{ color: "#94a3b8", padding: "20px", textAlign: "center" }}>
                  No usage data yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {usageData.byFeature.map((item) => (
                    <div key={item.feature}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.875rem" }}>
                          {FEATURE_LABELS[item.feature] || item.feature}
                        </span>
                        <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                          {formatTokens(item.totalTokens)} ({formatCost(item.totalCost)})
                        </span>
                      </div>
                      <div
                        style={{
                          height: "8px",
                          background: "#f1f5f9",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(item.totalTokens / maxTokens) * 100}%`,
                            background: "linear-gradient(90deg, #0ea5e9, #6366f1)",
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daily Usage Chart */}
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Daily Usage</h3>
              {usageData.daily.length === 0 ? (
                <div style={{ color: "#94a3b8", padding: "20px", textAlign: "center" }}>
                  No usage data yet
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "150px" }}>
                  {usageData.daily.slice(-30).map((day) => (
                    <div
                      key={day.date}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        position: "relative",
                      }}
                      title={`${day.date}: ${formatTokens(day.tokens)} tokens, ${formatCost(day.cost)}`}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${(day.tokens / maxDailyTokens) * 120}px`,
                          minHeight: day.tokens > 0 ? "4px" : "0px",
                          background: "linear-gradient(180deg, #0ea5e9, #6366f1)",
                          borderRadius: "2px 2px 0 0",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "8px",
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                }}
              >
                <span>{usageData.daily[0]?.date || ""}</span>
                <span>{usageData.daily[usageData.daily.length - 1]?.date || ""}</span>
              </div>
            </div>
          </div>

          {/* Recent Calls Table */}
          <div
            style={{
              padding: "24px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: "16px" }}>Recent API Calls</h3>
            {usageData.recentCalls.length === 0 ? (
              <div style={{ color: "#94a3b8", padding: "20px", textAlign: "center" }}>
                No recent calls
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 500 }}>Time</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 500 }}>Feature</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>Input</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>Output</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>Total</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 500 }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.recentCalls.map((call) => (
                      <tr key={call.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>
                          {new Date(call.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {FEATURE_LABELS[call.feature] || call.feature}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace" }}>
                          {formatTokens(call.inputTokens)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace" }}>
                          {formatTokens(call.outputTokens)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace" }}>
                          {formatTokens(call.totalTokens)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "#16a34a" }}>
                          {formatCost(call.estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Back Link */}
      <div style={{ marginTop: "32px", textAlign: "center" }}>
        <Link
          href="/"
          style={{
            color: "#0ea5e9",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
