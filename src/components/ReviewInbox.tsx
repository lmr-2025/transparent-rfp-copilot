"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface ReviewCounts {
  pending: number;
  approved: number;
  corrected: number;
}

const styles = {
  container: {
    position: "relative" as const,
  },
  badge: {
    position: "absolute" as const,
    top: "-4px",
    right: "-4px",
    backgroundColor: "#ef4444",
    color: "#fff",
    fontSize: "10px",
    fontWeight: 700,
    borderRadius: "999px",
    minWidth: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
  link: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    color: "#cbd5e1",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    width: "100%",
    textAlign: "left" as const,
    borderLeft: "3px solid transparent",
    textDecoration: "none",
  },
};

export default function ReviewInbox() {
  const { data: session } = useSession();
  const [counts, setCounts] = useState<ReviewCounts>({ pending: 0, approved: 0, corrected: 0 });

  // Fetch counts periodically (every 30 seconds) for badge
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const userId = session?.user?.id || "";
        const response = await fetch(`/api/reviews?status=REQUESTED&limit=1&assignedTo=${userId}&includeUnassigned=true`);
        if (response.ok) {
          const data = await response.json();
          setCounts(data.data?.counts || { pending: 0, approved: 0, corrected: 0 });
        }
      } catch (error) {
        // Silent fail for background fetch
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  return (
    <div style={styles.container}>
      <Link
        href="/reviews"
        style={styles.link}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#334155";
          e.currentTarget.style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#cbd5e1";
        }}
      >
        <span style={{ position: "relative" }}>
          Review Inbox
          {counts.pending > 0 && (
            <span style={styles.badge}>{counts.pending > 99 ? "99+" : counts.pending}</span>
          )}
        </span>
      </Link>
    </div>
  );
}

// Compact badge-only version for the sidebar nav
export function ReviewBadge() {
  const { data: session } = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const userId = session?.user?.id || "";
        const response = await fetch(`/api/reviews?status=REQUESTED&limit=1&assignedTo=${userId}&includeUnassigned=true`);
        if (response.ok) {
          const data = await response.json();
          setCount(data.data?.counts?.pending || 0);
        }
      } catch (error) {
        // Silent fail
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  if (count === 0) return null;

  return (
    <span style={{
      backgroundColor: "#ef4444",
      color: "#fff",
      fontSize: "10px",
      fontWeight: 700,
      borderRadius: "999px",
      minWidth: "18px",
      height: "18px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 5px",
      marginLeft: "8px",
    }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
