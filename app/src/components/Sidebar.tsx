"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    section: "Knowledge",
    items: [
      { href: "/knowledge", label: "Build Skills" },
      { href: "/knowledge/library", label: "Knowledge Library" },
    ],
  },
  {
    section: "Questions",
    items: [
      { href: "/questions", label: "Ask Questions" },
      { href: "/questions/bulk/projects", label: "Bulk Projects" },
    ],
  },
  {
    section: "Configuration",
    items: [
      { href: "/prompts", label: "Prompts" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      position: "fixed",
      left: 0,
      top: 0,
      bottom: 0,
      width: "240px",
      backgroundColor: "#1e293b",
      color: "#fff",
      padding: "24px 0",
      overflowY: "auto",
      zIndex: 100,
    }}>
      <div style={{ padding: "0 20px", marginBottom: "32px" }}>
        <Link href="/knowledge" style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "#fff",
          textDecoration: "none",
          display: "block",
        }}>
          GRC Minion
        </Link>
        <p style={{
          fontSize: "12px",
          color: "#94a3b8",
          marginTop: "4px",
          marginBottom: 0,
        }}>
          Security Questionnaire Assistant
        </p>
      </div>

      <nav>
        {navItems.map((section) => (
          <div key={section.section} style={{ marginBottom: "24px" }}>
            <div style={{
              padding: "0 20px",
              fontSize: "11px",
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "8px",
            }}>
              {section.section}
            </div>
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "10px 20px",
                    color: isActive ? "#fff" : "#cbd5e1",
                    backgroundColor: isActive ? "#334155" : "transparent",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: isActive ? 600 : 400,
                    borderLeft: isActive ? "3px solid #3b82f6" : "3px solid transparent",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "#334155";
                      e.currentTarget.style.color = "#fff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#cbd5e1";
                    }
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
