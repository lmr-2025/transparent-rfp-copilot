"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function BulkProjectRedirect() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}`);
    } else {
      router.replace("/projects");
    }
  }, [router, projectId]);

  return (
    <div style={{ padding: "24px", textAlign: "center" }}>
      Redirecting to Project...
    </div>
  );
}
