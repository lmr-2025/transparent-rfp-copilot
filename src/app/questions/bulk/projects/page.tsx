"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserve query params when redirecting
    const params = searchParams.toString();
    const destination = params ? `/projects?${params}` : "/projects";
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <div style={{ padding: "24px", textAlign: "center" }}>
      Redirecting to Projects...
    </div>
  );
}

import { Suspense } from "react";

export default function BulkProjectsRedirect() {
  return (
    <Suspense fallback={<div style={{ padding: "24px", textAlign: "center" }}>Redirecting...</div>}>
      <RedirectContent />
    </Suspense>
  );
}
