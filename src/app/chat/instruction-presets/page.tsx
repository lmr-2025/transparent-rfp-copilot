"use client";

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import PresetsTab from "./components/PresetsTab";
import BuilderTab from "./components/BuilderTab";

type TabId = "presets" | "builder";

const TABS: { id: TabId; label: string }[] = [
  { id: "presets", label: "Presets" },
  { id: "builder", label: "Builder" },
];

function InstructionsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "presets";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = userRole === "ADMIN" || userRole === "PROMPT_ADMIN";

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    router.push(`/chat/instruction-presets?tab=${tab}`, { scroll: false });
  };

  if (status === "loading") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#64748b",
      }}>
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{
        padding: "40px",
        textAlign: "center",
      }}>
        <h1 style={{ color: "#dc2626", marginBottom: "16px" }}>Access Denied</h1>
        <p style={{ color: "#64748b" }}>You need admin permissions to access this page.</p>
        <Link href="/" style={{ color: "#0ea5e9" }}>Go Home</Link>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid #e2e8f0",
        backgroundColor: "#fff",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}>
          <div>
            <h1 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 700 }}>
              Instructions
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
              Manage chat instruction presets and build new ones with AI assistance
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          gap: "4px",
          marginTop: "16px",
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor: activeTab === tab.id ? "#6366f1" : "transparent",
                color: activeTab === tab.id ? "#fff" : "#64748b",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
      }}>
        {activeTab === "presets" && <PresetsTab />}
        {activeTab === "builder" && (
          <BuilderTab onPresetSaved={() => handleTabChange("presets")} />
        )}
      </div>
    </div>
  );
}

export default function InstructionsPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#64748b",
      }}>
        Loading...
      </div>
    }>
      <InstructionsContent />
    </Suspense>
  );
}
