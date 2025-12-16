"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useBranding } from "@/lib/branding";
import { features } from "@/lib/featureFlags";

type CardProps = {
  href: string;
  title: string;
  description: string;
  accentColor: string;
  bgColor: string;
  featured?: boolean;
};

function Card({ href, title, description, accentColor, bgColor, featured }: CardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          borderLeft: `4px solid ${accentColor}`,
          borderTop: "1px solid #e2e8f0",
          borderRight: "1px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: featured ? "24px" : "20px",
          backgroundColor: isHovered ? bgColor : "#fff",
          cursor: "pointer",
          height: "100%",
          transform: isHovered ? "translateY(-2px)" : "translateY(0)",
          boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.08)" : "none",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{
          fontSize: featured ? "1.15rem" : "1rem",
          fontWeight: 600,
          marginBottom: "6px",
          color: "#1e293b",
        }}>
          {title}
        </div>
        <p style={{
          margin: 0,
          color: "#64748b",
          fontSize: "0.9rem",
          lineHeight: 1.5,
        }}>
          {description}
        </p>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { branding, isLoading } = useBranding();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "PROMPT_ADMIN";

  return (
    <div style={{
      maxWidth: "960px",
      margin: "0 auto",
      padding: "24px",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    }}>
      {/* Hero Section */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        {isLoading ? (
          <>
            <div style={{
              height: "2rem",
              width: "200px",
              backgroundColor: "#e2e8f0",
              borderRadius: "4px",
              margin: "0 auto 12px",
            }} />
            <div style={{
              height: "1rem",
              width: "400px",
              backgroundColor: "#f1f5f9",
              borderRadius: "4px",
              margin: "0 auto",
            }} />
          </>
        ) : (
          <>
            <h1 style={{
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: "12px",
              color: "#1e293b",
            }}>
              {branding.appName}
            </h1>
            <p style={{
              fontSize: "1.05rem",
              color: "#64748b",
              maxWidth: "600px",
              margin: "0 auto",
              lineHeight: 1.6,
            }}>
              {branding.tagline}
            </p>
          </>
        )}
      </div>

      {/* Foundation Section */}
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "12px",
        }}>
          Foundation
        </h2>
        <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "16px" }}>
          These power everything else. Build your knowledge base and configure how AI responds.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: isAdmin ? "repeat(2, 1fr)" : "1fr", gap: "16px" }}>
          <Card
            href="/knowledge"
            title="Knowledge Base"
            description="Skills, documents, URLs, and customer profiles that ground all AI responses. Your single source of truth."
            accentColor="#f59e0b"
            bgColor="#fffbeb"
            featured
          />
          {isAdmin && (
            <Card
              href="/admin/prompt-blocks"
              title="Prompt Builder"
              description="Configure how AI responds across all features. Edit system prompts, output formats, and quality rules."
              accentColor="#8b5cf6"
              bgColor="#faf5ff"
              featured
            />
          )}
        </div>
      </div>

      {/* Main Features Section */}
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "12px",
        }}>
          Features
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          <Card
            href="/projects"
            title="RFP Projects"
            description="Upload spreadsheets, answer questions one at a time, or process hundreds in bulk. Full audit trails and export."
            accentColor="#0ea5e9"
            bgColor="#f0f9ff"
          />
          {features.customerProfiles && (
            <Card
              href="/customers"
              title="The Rolodex"
              description="Build and manage customer intelligence from websites, documents, and Salesforce. AI-powered profile generation."
              accentColor="#f97316"
              bgColor="#fff7ed"
            />
          )}
          {features.chat && (
            <Card
              href="/chat"
              title="Chat"
              description="Conversational interface to explore your knowledge base. Select specific skills and customer profiles."
              accentColor="#22c55e"
              bgColor="#f0fdf4"
            />
          )}
          {features.contracts && (
            <Card
              href="/contracts"
              title="Contracts"
              description="Upload and analyze contracts. Extract key terms, identify risks, and review obligations."
              accentColor="#ec4899"
              bgColor="#fdf2f8"
            />
          )}
        </div>
      </div>

      {/* Full Transparency Section */}
      <div style={{
        borderRadius: "12px",
        padding: "28px",
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}>
        <h2 style={{
          margin: "0 0 24px 0",
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "#1e293b",
        }}>
          Full Transparency, Every Time
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
          <div>
            <h4 style={{ margin: "0 0 8px 0", color: "#0369a1", fontSize: "0.95rem", fontWeight: 600 }}>
              Confidence Scores
            </h4>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
              Every answer includes a confidence level so you know when to trust it and when to verify.
            </p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 8px 0", color: "#0369a1", fontSize: "0.95rem", fontWeight: 600 }}>
              Source Citations
            </h4>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
              See exactly which skills, documents, and URLs were used to generate each response.
            </p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 8px 0", color: "#0369a1", fontSize: "0.95rem", fontWeight: 600 }}>
              Reasoning Visible
            </h4>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
              Understand the logic: what was found directly vs. what was inferred from context.
            </p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 8px 0", color: "#0369a1", fontSize: "0.95rem", fontWeight: 600 }}>
              Editable Prompts
            </h4>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
              No black boxes. View and customize the system prompts that guide AI behavior.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
