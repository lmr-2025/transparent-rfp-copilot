"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { loadCategoriesFromApi } from "@/lib/categoryStorage";
import { SkillCategoryItem } from "@/types/skill";

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "32px 24px",
  },
  header: {
    marginBottom: "32px",
  },
  backLink: {
    color: "#64748b",
    textDecoration: "none",
    fontSize: "0.9rem",
    display: "inline-block",
    marginBottom: "16px",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#1e293b",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "0.95rem",
    color: "#64748b",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "24px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#374151",
  },
  labelHint: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    fontWeight: 400,
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.15s ease",
  },
  textarea: {
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "0.95rem",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "80px",
    fontFamily: "inherit",
  },
  categoryContainer: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
  },
  categoryChip: (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "6px",
    border: selected ? "1px solid #818cf8" : "1px solid #cbd5e1",
    backgroundColor: selected ? "#e0e7ff" : "#fff",
    color: selected ? "#3730a3" : "#475569",
    cursor: "pointer",
    fontSize: "13px",
    transition: "all 0.15s ease",
  }),
  buttonGroup: {
    display: "flex",
    gap: "12px",
    marginTop: "8px",
  },
  submitButton: {
    padding: "12px 24px",
    backgroundColor: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "0.95rem",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  cancelButton: {
    padding: "12px 24px",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "0.95rem",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
  },
  error: {
    color: "#dc2626",
    fontSize: "0.875rem",
    marginTop: "4px",
  },
};

export default function AddReferenceUrlPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<SkillCategoryItem[]>([]);

  // Load categories from API on mount
  useEffect(() => {
    loadCategoriesFromApi().then(setCategories).catch(() => toast.error("Failed to load categories"));
  }, []);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCategoryToggle = (categoryName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("URL is required");
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmedUrl);
    } catch {
      setError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/reference-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          categories: selectedCategories,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add reference URL");
      }

      toast.success("Reference URL added successfully");
      router.push("/knowledge?tab=urls");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add reference URL";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Link href="/knowledge?tab=urls" style={styles.backLink}>
          ← Back to Library
        </Link>
        <h1 style={styles.title}>Add Reference URL</h1>
        <p style={styles.subtitle}>
          Add a URL as a fallback source. Content will be fetched on-demand when skills don&apos;t have the answer.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            URL <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/trust-center"
            style={styles.input}
            autoFocus
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Title <span style={styles.labelHint}>(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Trust Center - Security Documentation"
            style={styles.input}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Description <span style={styles.labelHint}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this URL contains..."
            style={styles.textarea}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Categories <span style={styles.labelHint}>(optional)</span>
          </label>
          <div style={styles.categoryContainer}>
            {categories.map((cat) => {
              const isSelected = selectedCategories.includes(cat.name);
              return (
                <label
                  key={cat.id}
                  style={styles.categoryChip(isSelected)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleCategoryToggle(cat.name)}
                    style={{ margin: 0 }}
                  />
                  {cat.name}
                </label>
              );
            })}
            {categories.length === 0 && (
              <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                No categories defined yet
              </span>
            )}
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.buttonGroup}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...styles.submitButton,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Adding..." : "Add Reference URL"}
          </button>
          <Link href="/knowledge?tab=urls" style={styles.cancelButton}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
