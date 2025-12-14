import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "32px 48px",
          maxWidth: "500px",
        }}
      >
        <h2
          style={{
            color: "#1e293b",
            fontSize: "72px",
            fontWeight: 700,
            margin: "0 0 8px 0",
          }}
        >
          404
        </h2>
        <h3
          style={{
            color: "#475569",
            fontSize: "20px",
            fontWeight: 500,
            margin: "0 0 12px 0",
          }}
        >
          Page not found
        </h3>
        <p
          style={{
            color: "#64748b",
            fontSize: "14px",
            margin: "0 0 24px 0",
            lineHeight: 1.5,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            backgroundColor: "#2563eb",
            color: "#fff",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
