import { redirect } from "next/navigation";

// Redirect to main usage page - they were identical
export default function AdminUsagePage() {
  redirect("/usage");
}
