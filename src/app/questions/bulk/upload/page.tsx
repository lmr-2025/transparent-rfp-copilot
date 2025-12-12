"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BulkUploadRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/projects/upload");
  }, [router]);

  return (
    <div style={{ padding: "24px", textAlign: "center" }}>
      Redirecting to Projects Upload...
    </div>
  );
}
