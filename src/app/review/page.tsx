"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect to Projects page with Needs Review filter
 * The Review Queue functionality has been consolidated into the Projects page
 */
export default function ReviewQueueRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/projects?filter=needs_review");
  }, [router]);

  return (
    <div style={{
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "24px",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    }}>
      <div style={{
        textAlign: "center",
        padding: "40px",
        color: "#94a3b8",
      }}>
        Redirecting to Projects...
      </div>
    </div>
  );
}
