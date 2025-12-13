"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

type NavItem = {
  href: string;
  label: string;
};

type NavSection = {
  section: string;
  items: NavItem[];
  adminOnly?: boolean;
};

const navItems: NavSection[] = [
  {
    section: "Knowledge Gremlin",
    items: [
      { href: "/knowledge", label: "Build Skills" },
      { href: "/knowledge/unified-library", label: "Library" },
    ],
  },
  {
    section: "Rolodex",
    items: [
      { href: "/customers", label: "Build Profile" },
      { href: "/customers/library", label: "Library" },
    ],
  },
  {
    section: "Oracle",
    items: [
      { href: "/chat", label: "Chat" },
      { href: "/prompts/library", label: "Prompt Library" },
    ],
  },
  {
    section: "Clause Checker",
    items: [
      { href: "/contracts", label: "Upload Contract" },
      { href: "/contracts/library", label: "Library" },
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
    ],
  },
  {
    section: "Backstage",
    adminOnly: true,
    items: [
      { href: "/prompts", label: "System Prompts" },
      { href: "/knowledge/categories", label: "Categories" },
      { href: "/usage", label: "API Usage" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter(
    (section) => !section.adminOnly || isAdmin
  );

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
          Transparent LLM Assistant
        </p>
      </div>

      <nav style={{ flex: 1 }}>
        {visibleNavItems.map((section) => (
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
