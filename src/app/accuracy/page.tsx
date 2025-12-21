"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DashboardTab,
  QuestionsTab,
  ContractsTab,
  RFPsTab,
  TABS,
  type TabId,
} from "./components";

export default function AccuracyPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && TABS.some(t => t.id === tabParam) ? tabParam : "dashboard"
  );
  const [days, setDays] = useState(30);

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    router.push(`/accuracy?tab=${tab}`, { scroll: false });
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "8px" }}>
          AI Accuracy
        </h1>
        <p style={{ color: "#64748b" }}>
          Track answer quality and review feedback from all sources
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "2px solid #e2e8f0" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: "12px 20px",
              fontSize: "0.95rem",
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "#0ea5e9" : "#64748b",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #0ea5e9" : "2px solid transparent",
              marginBottom: "-2px",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && (
        <DashboardTab days={days} onDaysChange={setDays} />
      )}

      {activeTab === "questions" && (
        <QuestionsTab isAdmin={isAdmin} />
      )}

      {activeTab === "contracts" && (
        <ContractsTab />
      )}

      {activeTab === "rfps" && (
        <RFPsTab />
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
