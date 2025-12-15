"use client";

import Link from "next/link";
import {
  Link2,
  FileUp,
  Layers,
  BookOpen,
  ArrowRight,
  Users,
  Globe,
  FileText,
  Sparkles,
  FileCode,
} from "lucide-react";

const styles = {
  container: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "32px 24px",
  },
  header: {
    marginBottom: "40px",
    textAlign: "center" as const,
  },
  title: {
    fontSize: "2rem",
    fontWeight: 700,
    marginBottom: "12px",
    color: "#1e293b",
  },
  subtitle: {
    fontSize: "1.1rem",
    color: "#64748b",
    maxWidth: "600px",
    margin: "0 auto",
    lineHeight: 1.6,
  },
  sectionTitle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "16px",
    marginTop: "32px",
  },
  methodsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  methodCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#fff",
    transition: "all 0.2s",
    textDecoration: "none",
    color: "inherit",
    display: "block",
  },
  iconWrapper: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "12px",
  },
  methodTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "6px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#1e293b",
  },
  methodDescription: {
    fontSize: "0.9rem",
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: "12px",
  },
  methodBestFor: {
    fontSize: "0.8rem",
    color: "#0369a1",
    backgroundColor: "#f0f9ff",
    padding: "6px 10px",
    borderRadius: "6px",
  },
  arrow: {
    marginLeft: "auto",
    color: "#94a3b8",
  },
  infoSection: {
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    padding: "24px",
    marginTop: "40px",
  },
  infoTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  infoItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  infoNumber: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: "#0ea5e9",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.8rem",
    fontWeight: 600,
    flexShrink: 0,
  },
  infoText: {
    fontSize: "0.9rem",
    color: "#475569",
    lineHeight: 1.4,
  },
  quickLinks: {
    display: "flex",
    gap: "16px",
    justifyContent: "center",
    flexWrap: "wrap" as const,
    marginTop: "32px",
  },
  quickLink: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 16px",
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    color: "#475569",
    textDecoration: "none",
    fontSize: "0.9rem",
    transition: "all 0.2s",
  },
};

const skillMethods = [
  {
    href: "/knowledge/from-url",
    icon: Link2,
    iconBg: "#e0f2fe",
    iconColor: "#0284c7",
    borderColor: "#bae6fd",
    title: "From URL",
    description: "Paste a URL and let AI extract structured knowledge from web pages, documentation, and blog posts.",
    bestFor: "Trust centers, product docs, blog posts",
  },
  {
    href: "/knowledge/bulk",
    icon: Layers,
    iconBg: "#dcfce7",
    iconColor: "#16a34a",
    borderColor: "#bbf7d0",
    title: "Bulk URL Import",
    description: "Import multiple URLs at once. Batch process them into skills with a single click.",
    bestFor: "Sitemap imports, documentation sets",
  },
  {
    href: "/knowledge/import",
    icon: FileUp,
    iconBg: "#fef3c7",
    iconColor: "#d97706",
    borderColor: "#fde68a",
    title: "From Documents",
    description: "Upload PDF, Word, or text files. AI will analyze and create skills from existing documentation.",
    bestFor: "SOC2 reports, whitepapers, internal docs",
  },
];

const otherMethods = [
  {
    href: "/knowledge/from-url?type=snippet",
    icon: FileCode,
    iconBg: "#d1fae5",
    iconColor: "#059669",
    borderColor: "#a7f3d0",
    title: "Create Context Snippet",
    description: "Build reusable boilerplate text from URLs or documents. Use {{key}} variables in instruction presets.",
    bestFor: "Company descriptions, value props, certifications",
  },
  {
    href: "/knowledge/documents",
    icon: FileText,
    iconBg: "#fef3c7",
    iconColor: "#d97706",
    borderColor: "#fde68a",
    title: "Upload Document",
    description: "Upload documents to be searched when skills don't have the answer. Content is cited in responses.",
    bestFor: "Reference material, long-form docs",
  },
  {
    href: "/knowledge/urls/add",
    icon: Globe,
    iconBg: "#e0e7ff",
    iconColor: "#6366f1",
    borderColor: "#c7d2fe",
    title: "Add Reference URL",
    description: "Add external URLs to be fetched on-demand as fallback when other sources don't have the answer.",
    bestFor: "Trust centers, external security docs",
  },
  {
    href: "/customers/add",
    icon: Users,
    iconBg: "#fce7f3",
    iconColor: "#db2777",
    borderColor: "#fbcfe8",
    title: "Build Customer Profile",
    description: "Create customer intelligence from websites, press releases, and documents for personalized responses.",
    bestFor: "Customer context, personalization",
  },
];

export default function AddToKnowledgeBasePage() {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Add to Knowledge Base</h1>
        <p style={styles.subtitle}>
          Build your knowledge base to ground AI responses. Choose how you want to add information.
        </p>
      </div>

      {/* Skills Section */}
      <div>
        <h2 style={styles.sectionTitle}>Build Skills</h2>
        <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "16px", marginTop: "-8px" }}>
          Skills are structured facts that are injected directly into prompts. They&apos;re the most reliable source for answers.
        </p>
        <div style={styles.methodsGrid}>
          {skillMethods.map((method) => (
            <Link
              key={method.href}
              href={method.href}
              style={{
                ...styles.methodCard,
                borderColor: method.borderColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = method.iconColor;
                e.currentTarget.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.08)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = method.borderColor;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  ...styles.iconWrapper,
                  backgroundColor: method.iconBg,
                }}
              >
                <method.icon size={22} style={{ color: method.iconColor }} />
              </div>
              <div style={styles.methodTitle}>
                {method.title}
                <ArrowRight size={16} style={styles.arrow} />
              </div>
              <p style={styles.methodDescription}>{method.description}</p>
              <div style={styles.methodBestFor}>
                <strong>Best for:</strong> {method.bestFor}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Other Knowledge Types */}
      <div>
        <h2 style={styles.sectionTitle}>Other Knowledge Types</h2>
        <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "16px", marginTop: "-8px" }}>
          Documents and URLs are searched when skills don&apos;t have the answer. Customer profiles provide context for personalized responses.
        </p>
        <div style={styles.methodsGrid}>
          {otherMethods.map((method) => (
            <Link
              key={method.href}
              href={method.href}
              style={{
                ...styles.methodCard,
                borderColor: method.borderColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = method.iconColor;
                e.currentTarget.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.08)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = method.borderColor;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  ...styles.iconWrapper,
                  backgroundColor: method.iconBg,
                }}
              >
                <method.icon size={22} style={{ color: method.iconColor }} />
              </div>
              <div style={styles.methodTitle}>
                {method.title}
                <ArrowRight size={16} style={styles.arrow} />
              </div>
              <p style={styles.methodDescription}>{method.description}</p>
              <div style={styles.methodBestFor}>
                <strong>Best for:</strong> {method.bestFor}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* How Knowledge Works */}
      <div style={styles.infoSection}>
        <h2 style={styles.infoTitle}>
          <Sparkles size={18} style={{ color: "#0ea5e9" }} />
          How Knowledge is Used
        </h2>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <div style={styles.infoNumber}>1</div>
            <div style={styles.infoText}>
              <strong>Skills first</strong> — Structured facts injected directly into the prompt
            </div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoNumber}>2</div>
            <div style={styles.infoText}>
              <strong>Documents searched</strong> — If skills don&apos;t have the answer, documents are searched
            </div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoNumber}>3</div>
            <div style={styles.infoText}>
              <strong>URLs fetched</strong> — As a fallback, reference URLs are fetched on-demand
            </div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoNumber}>4</div>
            <div style={styles.infoText}>
              <strong>Customer context</strong> — Profiles can be selected to personalize responses
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div style={styles.quickLinks}>
        <Link
          href="/knowledge"
          style={styles.quickLink}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#0ea5e9";
            e.currentTarget.style.color = "#0369a1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.color = "#475569";
          }}
        >
          <BookOpen size={16} />
          View Library
        </Link>
        <Link
          href="/customers"
          style={styles.quickLink}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#db2777";
            e.currentTarget.style.color = "#be185d";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.color = "#475569";
          }}
        >
          <Users size={16} />
          View Customers
        </Link>
      </div>
    </div>
  );
}
