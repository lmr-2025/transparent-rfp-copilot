"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect to main knowledge page - library functionality has been consolidated
export default function LibraryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/knowledge");
  }, [router]);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontFamily: "system-ui, sans-serif",
    }}>
      <p style={{ color: "#64748b" }}>Redirecting to Knowledge Library...</p>
    </div>
  );
}
