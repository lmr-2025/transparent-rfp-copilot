"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useBranding } from "@/lib/branding";
import { features } from "@/lib/featureFlags";
import ReviewInbox from "./ReviewInbox";

type NavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
  featureFlag?: keyof typeof features;
};

type NavSection = {
  section: string;
  items: NavItem[];
  adminOnly?: boolean;
  featureFlag?: keyof typeof features;
};

const navItems: NavSection[] = [
  {
    section: "Home",
    items: [
      { href: "/", label: "Dashboard" },
    ],
  },
  {
    section: "RFP Projects",
    items: [
      { href: "/projects/questions", label: "Quick Questions" },
      { href: "/projects", label: "All Projects" },
    ],
  },
  {
    section: "Knowledge Base",
    items: [
      { href: "/knowledge", label: "Library" },
      { href: "/knowledge/add", label: "Add Knowledge" },
    ],
  },
  {
    section: "The Rolodex",
    featureFlag: "customerProfiles",
    items: [
      { href: "/customers", label: "Customer Profiles" },
      { href: "/customers/add", label: "Build Profile" },
    ],
  },
  {
    section: "Oracle",
    featureFlag: "chat",
    items: [
      { href: "/chat", label: "Chat" },
      { href: "/chat/instruction-presets", label: "Instructions", adminOnly: true },
    ],
  },
  {
    section: "Contract Review",
    featureFlag: "contracts",
    items: [
      { href: "/contracts", label: "Library" },
      { href: "/contracts/upload", label: "Upload" },
    ],
  },
  {
    section: "Backstage",
    adminOnly: true,
    items: [
      { href: "/admin/prompt-blocks", label: "Prompt Builder" },
      { href: "/accuracy", label: "AI Accuracy" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { branding } = useBranding();

  // Check for admin access using capabilities (with legacy fallback)
  const userCapabilities = session?.user?.capabilities || [];
  const isAdmin = userCapabilities.includes("ADMIN") ||
    userCapabilities.includes("MANAGE_USERS") ||
    userCapabilities.includes("VIEW_ORG_DATA") ||
    session?.user?.role === "ADMIN";

  // Filter nav items based on user role and feature flags
  const visibleNavItems = navItems.filter((section) => {
    // Check admin-only
    if (section.adminOnly && !isAdmin) return false;
    // Check feature flag
    if (section.featureFlag && !features[section.featureFlag]) return false;
    return true;
  });

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
        <Link href="/" style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "#fff",
          textDecoration: "none",
          display: "block",
        }}>
          {branding.appName}
        </Link>
        <p style={{
          fontSize: "12px",
          color: "#94a3b8",
          marginTop: "4px",
          marginBottom: 0,
        }}>
          {branding.sidebarSubtitle}
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
            {section.items
              .filter((item) => {
                if (item.adminOnly && !isAdmin) return false;
                if (item.featureFlag && !features[item.featureFlag]) return false;
                return true;
              })
              .map((item) => {
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
                    borderLeft: isActive ? `3px solid ${branding.primaryColor}` : "3px solid transparent",
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

      {/* Review Inbox */}
      <div style={{
        padding: "0",
        marginBottom: "16px",
      }}>
        <div style={{
          padding: "0 20px",
          fontSize: "11px",
          fontWeight: 600,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "8px",
        }}>
          Reviews
        </div>
        <ReviewInbox />
      </div>

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
              backgroundColor: branding.primaryColor,
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
