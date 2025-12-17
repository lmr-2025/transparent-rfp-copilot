"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineError } from "@/components/ui/status-display";

type Step = "welcome" | "google" | "test" | "done";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<"pending" | "success" | "error">("pending");

  const handleSaveGoogle = async () => {
    if (!googleClientId || !googleClientSecret) {
      setError("Both Client ID and Client Secret are required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Save to database via setup API (doesn't require auth)
      const res1 = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "GOOGLE_CLIENT_ID", value: googleClientId }),
      });

      const res2 = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "GOOGLE_CLIENT_SECRET", value: googleClientSecret }),
      });

      if (!res1.ok || !res2.ok) {
        const data = await res1.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save credentials");
      }

      setStep("test");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const getCallbackUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/auth/callback/google`;
    }
    return "http://localhost:3000/api/auth/callback/google";
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f8fafc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        padding: "48px",
        maxWidth: "600px",
        width: "100%",
      }}>
        {step === "welcome" && (
          <>
            <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "#1e293b" }}>
              Welcome to Transparent Trust
            </h1>
            <p style={{ color: "#64748b", marginBottom: "32px" }}>
              Let&apos;s set up authentication so your team can sign in securely.
            </p>

            <div style={{
              backgroundColor: "#f1f5f9",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
            }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "#1e293b" }}>
                What you&apos;ll need:
              </h3>
              <ul style={{ color: "#64748b", fontSize: "14px", paddingLeft: "20px", margin: 0 }}>
                <li style={{ marginBottom: "8px" }}>Access to Google Cloud Console</li>
                <li style={{ marginBottom: "8px" }}>About 5 minutes to create OAuth credentials</li>
              </ul>
            </div>

            <button
              onClick={() => setStep("google")}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Get Started
            </button>

            <button
              onClick={() => router.push("/auth/signin")}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: "transparent",
                color: "#64748b",
                border: "none",
                fontSize: "14px",
                cursor: "pointer",
                marginTop: "12px",
              }}
            >
              Skip for now (use dev login)
            </button>
          </>
        )}

        {step === "google" && (
          <>
            <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "#1e293b" }}>
              Configure Google OAuth
            </h1>
            <p style={{ color: "#64748b", marginBottom: "24px" }}>
              Follow these steps to get your Google OAuth credentials.
            </p>

            {/* Step by step instructions */}
            <div style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px",
              fontSize: "14px",
            }}>
              <p style={{ fontWeight: 600, color: "#1e40af", marginBottom: "12px" }}>
                Steps in Google Cloud Console:
              </p>
              <ol style={{ color: "#1e40af", paddingLeft: "20px", margin: 0, lineHeight: 1.8 }}>
                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>Google Cloud Console → Credentials</a></li>
                <li>Click &quot;Create Credentials&quot; → &quot;OAuth client ID&quot;</li>
                <li>Select &quot;Web application&quot;</li>
                <li>Add authorized redirect URI:</li>
              </ol>
              <code style={{
                display: "block",
                backgroundColor: "#dbeafe",
                padding: "12px",
                borderRadius: "4px",
                marginTop: "8px",
                fontSize: "13px",
                wordBreak: "break-all",
              }}>
                {getCallbackUrl()}
              </code>
            </div>

            {error && (
              <div style={{ marginBottom: "16px" }}>
                <InlineError message={error} onDismiss={() => setError(null)} />
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px", color: "#1e293b" }}>
                Client ID
              </label>
              <input
                type="text"
                placeholder="xxxxx.apps.googleusercontent.com"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px", color: "#1e293b" }}>
                Client Secret
              </label>
              <input
                type="password"
                placeholder="GOCSPX-xxxxx"
                value={googleClientSecret}
                onChange={(e) => setGoogleClientSecret(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setStep("welcome")}
                style={{
                  flex: 1,
                  padding: "14px",
                  backgroundColor: "#fff",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={handleSaveGoogle}
                disabled={saving || !googleClientId || !googleClientSecret}
                style={{
                  flex: 2,
                  padding: "14px",
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: 500,
                  cursor: "pointer",
                  opacity: saving || !googleClientId || !googleClientSecret ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </>
        )}

        {step === "test" && (
          <>
            <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "#1e293b" }}>
              Almost Done!
            </h1>
            <p style={{ color: "#64748b", marginBottom: "24px" }}>
              Your credentials have been saved. There&apos;s one more step to activate them.
            </p>

            <div style={{
              backgroundColor: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px",
            }}>
              <p style={{ fontWeight: 600, color: "#92400e", marginBottom: "8px" }}>
                Important: Restart Required
              </p>
              <p style={{ fontSize: "14px", color: "#92400e", marginBottom: "12px" }}>
                For security, OAuth credentials are loaded at server startup. To activate Google sign-in:
              </p>
              <ol style={{ fontSize: "14px", color: "#92400e", paddingLeft: "20px", margin: 0 }}>
                <li>Copy these values to your <code>.env.local</code> file</li>
                <li>Restart the dev server</li>
              </ol>
            </div>

            <div style={{
              backgroundColor: "#f1f5f9",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px",
              fontFamily: "monospace",
              fontSize: "13px",
            }}>
              <p style={{ marginBottom: "8px" }}>GOOGLE_CLIENT_ID={googleClientId}</p>
              <p style={{ margin: 0 }}>GOOGLE_CLIENT_SECRET={googleClientSecret}</p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `GOOGLE_CLIENT_ID=${googleClientId}\nGOOGLE_CLIENT_SECRET=${googleClientSecret}`
                );
                setTestResult("success");
              }}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: testResult === "success" ? "#22c55e" : "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: "12px",
              }}
            >
              {testResult === "success" ? "Copied to clipboard!" : "Copy to Clipboard"}
            </button>

            <button
              onClick={() => router.push("/auth/signin")}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: "#fff",
                color: "#64748b",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              Go to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
