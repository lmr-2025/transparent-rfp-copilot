"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { FileCode, X, Copy, Check, Search, ChevronDown } from "lucide-react";

interface ContextSnippet {
  id: string;
  name: string;
  key: string;
  content: string;
  category: string | null;
  description: string | null;
}

interface SnippetPickerProps {
  onInsert: (snippetKey: string) => void;
  buttonStyle?: React.CSSProperties;
}

const styles = {
  button: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    backgroundColor: "#f0fdf4",
    color: "#059669",
    border: "1px solid #a7f3d0",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },
  dropdown: {
    position: "absolute" as const,
    top: "100%",
    right: 0,
    marginTop: "4px",
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
    width: "320px",
    maxHeight: "400px",
    overflow: "auto",
    zIndex: 1000,
  },
  header: {
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky" as const,
    top: 0,
    backgroundColor: "#fff",
    zIndex: 1,
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    backgroundColor: "#f8fafc",
  },
  searchInput: {
    border: "none",
    outline: "none",
    flex: 1,
    fontSize: "13px",
    backgroundColor: "transparent",
  },
  categoryHeader: {
    padding: "8px 12px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #f1f5f9",
  },
  snippetItem: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
    transition: "background-color 0.1s",
  },
  snippetName: {
    fontWeight: 500,
    fontSize: "13px",
    color: "#1e293b",
    marginBottom: "2px",
  },
  snippetKey: {
    fontFamily: "monospace",
    fontSize: "11px",
    color: "#0ea5e9",
    backgroundColor: "#f0f9ff",
    padding: "2px 6px",
    borderRadius: "3px",
  },
  snippetDescription: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "4px",
  },
  emptyState: {
    padding: "24px",
    textAlign: "center" as const,
    color: "#64748b",
    fontSize: "13px",
  },
  copyButton: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    backgroundColor: "#f1f5f9",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "11px",
    color: "#64748b",
    marginLeft: "auto",
  },
};

export default function SnippetPicker({ onInsert, buttonStyle }: SnippetPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [snippets, setSnippets] = useState<ContextSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Load snippets when dropdown opens
  useEffect(() => {
    if (isOpen && snippets.length === 0) {
      setIsLoading(true);
      fetch("/api/context-snippets")
        .then((res) => res.json())
        .then((data) => setSnippets(data))
        .catch(() => toast.error("Failed to load snippets"))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, snippets.length]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const filteredSnippets = searchQuery
    ? snippets.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : snippets;

  // Group by category
  const groupedSnippets: Record<string, ContextSnippet[]> = {};
  filteredSnippets.forEach((snippet) => {
    const cat = snippet.category || "Other";
    if (!groupedSnippets[cat]) groupedSnippets[cat] = [];
    groupedSnippets[cat].push(snippet);
  });

  const handleInsert = (key: string) => {
    onInsert(`{{${key}}}`);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleCopy = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ ...styles.button, ...buttonStyle }}
        title="Insert a context snippet variable"
      >
        <FileCode size={14} />
        Insert Snippet
        <ChevronDown size={14} style={{ marginLeft: "2px" }} />
      </button>

      {isOpen && (
        <div ref={dropdownRef} style={styles.dropdown}>
          <div style={styles.header}>
            <div style={styles.searchBox}>
              <Search size={14} style={{ color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search snippets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <X size={14} style={{ color: "#94a3b8" }} />
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div style={styles.emptyState}>Loading snippets...</div>
          ) : filteredSnippets.length === 0 ? (
            <div style={styles.emptyState}>
              {searchQuery
                ? "No snippets match your search"
                : "No context snippets yet. Create some in Knowledge → Snippets."}
            </div>
          ) : (
            Object.entries(groupedSnippets).map(([category, categorySnippets]) => (
              <div key={category}>
                <div style={styles.categoryHeader}>{category}</div>
                {categorySnippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    style={styles.snippetItem}
                    onClick={() => handleInsert(snippet.key)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={styles.snippetName}>{snippet.name}</div>
                        <code style={styles.snippetKey}>{`{{${snippet.key}}}`}</code>
                      </div>
                      <button
                        onClick={(e) => handleCopy(snippet.key, e)}
                        style={styles.copyButton}
                        title="Copy to clipboard"
                      >
                        {copiedKey === snippet.key ? (
                          <>
                            <Check size={12} style={{ color: "#22c55e" }} />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    {snippet.description && (
                      <div style={styles.snippetDescription}>{snippet.description}</div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
