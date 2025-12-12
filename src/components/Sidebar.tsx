"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

const navItems = [
  {
    section: "Knowledge Gremlin",
    items: [
      { href: "/knowledge", label: "Build Skills" },
      { href: "/knowledge/import", label: "Import from Docs" },
      { href: "/knowledge/library", label: "Library" },
      { href: "/knowledge/documents", label: "Documents" },
      { href: "/knowledge/urls", label: "Reference URLs" },
    ],
  },
  {
    section: "The Rolodex",
    items: [
      { href: "/customers", label: "Build Profile" },
      { href: "/customers/library", label: "Library" },
    ],
  },
  {
    section: "The Oracle",
    items: [
      { href: "/chat", label: "Chat" },
      { href: "/prompts/library", label: "Prompt Library" },
    ],
  },
  {
    section: "GRC Minion",
    items: [
      { href: "/questions", label: "Ask Questions" },
    ],
  },
  {
    section: "Answer Goblin",
    items: [
      { href: "/projects", label: "All Projects" },
      { href: "/projects/upload", label: "Upload New" },
      { href: "/projects?filter=needs_review", label: "Needs Review" },
    ],
  },
  {
    section: "TruthTeller",
    items: [
      { href: "/prompts", label: "System Prompts" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

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
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ padding: "0 20px", marginBottom: "32px" }}>
        <Link href="/knowledge" style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "#fff",
          textDecoration: "none",
          display: "block",
        }}>
          Transparent Trust
        </Link>
        <p style={{
          fontSize: "12px",
          color: "#94a3b8",
          marginTop: "4px",
          marginBottom: 0,
        }}>
          Knowledge-Powered AI Assistant
        </p>
      </div>

      <nav style={{ flex: 1 }}>
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

      {/* User section at bottom */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid #334155",
        marginTop: "auto",
      }}>
        {status === "loading" ? (
          <div style={{ color: "#94a3b8", fontSize: "13px" }}>Loading...</div>
        ) : session?.user ? (
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}>
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt=""
                  width={32}
                  height={32}
                  style={{
                    borderRadius: "50%",
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {session.user.name}
                </div>
                <div style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {session.user.email}
                </div>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "transparent",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#cbd5e1",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn()}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#3b82f6",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </aside>
  );
}
