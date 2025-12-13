"use client";

import Link from "next/link";
import { Link2, FileUp, Layers, BookOpen, ArrowRight, Sparkles } from "lucide-react";

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
  methodsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
    marginBottom: "40px",
  },
  methodCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "24px",
    backgroundColor: "#fff",
    transition: "all 0.2s",
    textDecoration: "none",
    color: "inherit",
    display: "block",
  },
  methodCardHover: {
    borderColor: "#0ea5e9",
    boxShadow: "0 4px 12px rgba(14, 165, 233, 0.15)",
  },
  iconWrapper: {
    width: "48px",
    height: "48px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
  },
  methodTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  methodDescription: {
    fontSize: "0.95rem",
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: "16px",
  },
  methodBestFor: {
    fontSize: "0.85rem",
    color: "#0369a1",
    backgroundColor: "#f0f9ff",
    padding: "8px 12px",
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
    marginBottom: "32px",
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

const methods = [
  {
    href: "/knowledge/from-url",
    icon: Link2,
    iconBg: "#e0f2fe",
    iconColor: "#0284c7",
    title: "From URL",
    description: "Paste a URL and let AI extract structured knowledge. Great for turning web pages, documentation, and blog posts into skills.",
    bestFor: "Trust centers, product docs, blog posts",
  },
  {
    href: "/knowledge/bulk",
    icon: Layers,
    iconBg: "#dcfce7",
    iconColor: "#16a34a",
    title: "Bulk URL Import",
    description: "Import multiple URLs at once. Paste a list of URLs and batch process them into skills with a single click.",
    bestFor: "Sitemap imports, documentation sets",
  },
  {
    href: "/knowledge/import",
    icon: FileUp,
    iconBg: "#fef3c7",
    iconColor: "#d97706",
    title: "From Documents",
    description: "Upload PDF, Word, or text files. AI will analyze the content and create skills from your existing documentation.",
    bestFor: "SOC2 reports, whitepapers, internal docs",
  },
];

export default function KnowledgeLandingPage() {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Build Skills</h1>
        <p style={styles.subtitle}>
          Skills are structured knowledge that help the AI answer questions accurately.
          Choose how you want to add knowledge to your library.
        </p>
      </div>

      {/* Methods Grid */}
      <div style={styles.methodsGrid}>
        {methods.map((method) => (
          <Link
            key={method.href}
            href={method.href}
            style={styles.methodCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0ea5e9";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(14, 165, 233, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                ...styles.iconWrapper,
                backgroundColor: method.iconBg,
              }}
            >
              <method.icon size={24} style={{ color: method.iconColor }} />
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

      {/* How Skills Work */}
      <div style={styles.infoSection}>
        <h2 style={styles.infoTitle}>
          <Sparkles size={18} style={{ color: "#0ea5e9" }} />
          How Skills Work
        </h2>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <div style={styles.infoNumber}>1</div>
            <div style={styles.infoText}>
              <strong>Add source content</strong> — URLs, documents, or paste text directly
            </div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoNumber}>2</div>
            <div style={styles.infoText}>
              <strong>AI extracts knowledge</strong> — structured facts, edge cases, and key details
            </div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoNumber}>3</div>
            <div style={styles.infoText}>
              <strong>Review and save</strong> — edit the draft, add categories, and save to your library
            </div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoNumber}>4</div>
            <div style={styles.infoText}>
              <strong>Use in chat</strong> — skills are automatically used to answer questions
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div style={styles.quickLinks}>
        <Link
          href="/knowledge/unified-library"
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
          href="/knowledge/categories"
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
          Manage Categories
        </Link>
      </div>
    </div>
  );
}
