"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  FileText,
  Globe,
  BookOpen,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  X,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { Skill } from "@/types/skill";
import { KnowledgeDocument } from "@/types/document";
import { ReferenceUrl } from "@/types/referenceUrl";
import { loadSkillsFromApi } from "@/lib/skillStorage";
import { loadCategories } from "@/lib/categoryStorage";

type TabType = "skills" | "documents" | "urls";

interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

// Unified item type for display
interface LibraryItem {
  id: string;
  title: string;
  description?: string;
  categories: string[];
  type: TabType;
  createdAt: string;
  // Type-specific data
  skillData?: Skill;
  documentData?: KnowledgeDocument;
  urlData?: ReferenceUrl;
}

const styles = {
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "24px",
  },
  header: {
    marginBottom: "24px",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    marginBottom: "8px",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "0.95rem",
  },
  tabBar: {
    display: "flex",
    gap: "4px",
    borderBottom: "1px solid #e2e8f0",
    marginBottom: "24px",
  },
  tab: {
    padding: "12px 20px",
    border: "none",
    background: "transparent",
    fontSize: "0.95rem",
    fontWeight: 500,
    color: "#64748b",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: "-1px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  tabActive: {
    color: "#0ea5e9",
    borderBottomColor: "#0ea5e9",
    fontWeight: 600,
  },
  tabCount: {
    backgroundColor: "#f1f5f9",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "0.8rem",
  },
  tabCountActive: {
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
  },
  controls: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    backgroundColor: "#fff",
    flex: 1,
    minWidth: "250px",
    maxWidth: "400px",
  },
  searchInput: {
    border: "none",
    outline: "none",
    flex: 1,
    fontSize: "0.95rem",
  },
  filterButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    backgroundColor: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
    color: "#475569",
  },
  filterButtonActive: {
    borderColor: "#0ea5e9",
    backgroundColor: "#f0f9ff",
    color: "#0369a1",
  },
  categoryDropdown: {
    position: "absolute" as const,
    top: "100%",
    left: 0,
    right: 0,
    marginTop: "4px",
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    zIndex: 50,
    maxHeight: "300px",
    overflowY: "auto" as const,
  },
  categoryOption: {
    padding: "10px 14px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #f1f5f9",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    backgroundColor: "#fff",
    transition: "border-color 0.2s",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "8px",
  },
  cardTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#1e293b",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  cardDescription: {
    color: "#64748b",
    fontSize: "0.9rem",
    marginBottom: "12px",
    lineHeight: 1.5,
  },
  cardMeta: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    alignItems: "center",
  },
  pill: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 500,
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
  },
  typeBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },
  typeBadgeSkill: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  typeBadgeDoc: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  typeBadgeUrl: {
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
  },
  emptyState: {
    padding: "60px 20px",
    textAlign: "center" as const,
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px dashed #cbd5e1",
  },
  deleteButton: {
    padding: "6px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#94a3b8",
    borderRadius: "4px",
    transition: "color 0.2s",
  },
  urlLink: {
    color: "#0ea5e9",
    fontSize: "0.85rem",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    textDecoration: "none",
  },
  expandButton: {
    padding: "4px 8px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#64748b",
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  expandedContent: {
    marginTop: "12px",
    padding: "12px",
    backgroundColor: "#f8fafc",
    borderRadius: "6px",
    fontSize: "0.9rem",
    lineHeight: 1.6,
  },
};

export default function UnifiedLibraryPage() {
  const [activeTab, setActiveTab] = useState<TabType>("skills");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Data states
  const [skills, setSkills] = useState<Skill[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [urls, setUrls] = useState<ReferenceUrl[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load all data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load skills
        const skillsData = await loadSkillsFromApi();
        setSkills(skillsData);

        // Load documents
        const docsResponse = await fetch("/api/documents");
        if (docsResponse.ok) {
          const docsData = await docsResponse.json();
          setDocuments(docsData.documents || []);
        }

        // Load URLs
        const urlsResponse = await fetch("/api/reference-urls");
        if (urlsResponse.ok) {
          const urlsData = await urlsResponse.json();
          setUrls(urlsData || []);
        }

        // Load categories
        const cats = loadCategories();
        setCategories(cats);
      } catch (error) {
        console.error("Failed to load library data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Convert data to unified items
  const libraryItems = useMemo((): LibraryItem[] => {
    const items: LibraryItem[] = [];

    // Add skills
    skills.forEach((skill) => {
      items.push({
        id: skill.id,
        title: skill.title,
        description: skill.content?.slice(0, 200),
        categories: skill.categories || [],
        type: "skills",
        createdAt: skill.createdAt,
        skillData: skill,
      });
    });

    // Add documents
    documents.forEach((doc) => {
      items.push({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        categories: doc.categories || [],
        type: "documents",
        createdAt: doc.uploadedAt,
        documentData: doc,
      });
    });

    // Add URLs
    urls.forEach((url) => {
      items.push({
        id: url.id,
        title: url.title,
        description: url.description,
        categories: url.categories || [],
        type: "urls",
        createdAt: url.addedAt,
        urlData: url,
      });
    });

    return items;
  }, [skills, documents, urls]);

  // Filter items by tab, search, and category
  const filteredItems = useMemo(() => {
    return libraryItems.filter((item) => {
      // Filter by tab
      if (item.type !== activeTab) return false;

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDescription = item.description?.toLowerCase().includes(query);
        const matchesCategories = item.categories.some(c => c.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDescription && !matchesCategories) return false;
      }

      // Filter by category
      if (selectedCategory && !item.categories.includes(selectedCategory)) {
        return false;
      }

      return true;
    });
  }, [libraryItems, activeTab, searchQuery, selectedCategory]);

  // Get counts for each tab
  const tabCounts = useMemo(() => ({
    skills: skills.length,
    documents: documents.length,
    urls: urls.length,
  }), [skills, documents, urls]);

  // Get unique categories from current tab items
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    libraryItems
      .filter(item => item.type === activeTab)
      .forEach(item => item.categories.forEach(c => cats.add(c)));
    return Array.from(cats).sort();
  }, [libraryItems, activeTab]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (response.ok) {
        setDocuments(documents.filter(d => d.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleDeleteUrl = async (id: string) => {
    if (!confirm("Are you sure you want to delete this URL?")) return;
    try {
      const response = await fetch(`/api/reference-urls/${id}`, { method: "DELETE" });
      if (response.ok) {
        setUrls(urls.filter(u => u.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete URL:", error);
    }
  };

  const getTypeIcon = (type: TabType) => {
    switch (type) {
      case "skills": return <BookOpen size={16} />;
      case "documents": return <FileText size={16} />;
      case "urls": return <Globe size={16} />;
    }
  };

  const getTypeBadgeStyle = (type: TabType) => {
    switch (type) {
      case "skills": return { ...styles.typeBadge, ...styles.typeBadgeSkill };
      case "documents": return { ...styles.typeBadge, ...styles.typeBadgeDoc };
      case "urls": return { ...styles.typeBadge, ...styles.typeBadgeUrl };
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderItemCard = (item: LibraryItem) => {
    const isExpanded = expandedItems.has(item.id);

    return (
      <div key={item.id} style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={{ flex: 1 }}>
            <div style={styles.cardTitle}>
              {getTypeIcon(item.type)}
              {item.type === "skills" ? (
                <Link
                  href={`/knowledge/library?skill=${item.id}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {item.title}
                </Link>
              ) : (
                item.title
              )}
            </div>

            {/* URL-specific link */}
            {item.type === "urls" && item.urlData && (
              <a
                href={item.urlData.url}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.urlLink}
              >
                {item.urlData.url}
                <ExternalLink size={12} />
              </a>
            )}

            {/* Document-specific info */}
            {item.type === "documents" && item.documentData && (
              <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>
                {item.documentData.filename} • {formatFileSize(item.documentData.fileSize)} • {item.documentData.fileType.toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Expand button for skills */}
            {item.type === "skills" && (
              <button
                onClick={() => toggleExpand(item.id)}
                style={styles.expandButton}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {isExpanded ? "Less" : "More"}
              </button>
            )}

            {/* Delete button for documents and URLs */}
            {(item.type === "documents" || item.type === "urls") && (
              <button
                onClick={() => {
                  if (item.type === "documents") handleDeleteDocument(item.id);
                  else handleDeleteUrl(item.id);
                }}
                style={styles.deleteButton}
                title="Delete"
                onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#94a3b8"}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {item.description && !isExpanded && (
          <p style={styles.cardDescription}>
            {item.description.slice(0, 150)}
            {item.description.length > 150 ? "..." : ""}
          </p>
        )}

        {/* Expanded content for skills */}
        {item.type === "skills" && isExpanded && item.skillData && (
          <div style={styles.expandedContent}>
            <div style={{ marginBottom: "12px" }}>
              <strong>Content:</strong>
              <p style={{ margin: "4px 0 0 0", whiteSpace: "pre-wrap" }}>
                {item.skillData.content}
              </p>
            </div>
            {item.skillData.quickFacts && item.skillData.quickFacts.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <strong>Quick Facts:</strong>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                  {item.skillData.quickFacts.map((fact, i) => (
                    <li key={i}>
                      <strong>{fact.question}:</strong> {fact.answer}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.skillData.edgeCases && item.skillData.edgeCases.length > 0 && (
              <div>
                <strong>Edge Cases:</strong>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                  {item.skillData.edgeCases.map((edge, i) => (
                    <li key={i}>{edge}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Categories and meta info */}
        <div style={styles.cardMeta}>
          {item.categories.map((cat) => (
            <span key={cat} style={styles.pill}>{cat}</span>
          ))}
          {item.categories.length === 0 && (
            <span style={{ ...styles.pill, backgroundColor: "#f1f5f9", color: "#64748b" }}>
              Uncategorized
            </span>
          )}
          <span style={{ color: "#94a3b8", fontSize: "0.8rem", marginLeft: "auto" }}>
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Loader2 size={40} className="animate-spin" style={{ color: "#0ea5e9", margin: "0 auto 16px" }} />
          <p style={{ color: "#64748b" }}>Loading library...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Knowledge Library</h1>
        <p style={styles.subtitle}>
          Your knowledge base for answering questions. Items here are used by the AI based on your prompt configuration.
        </p>
      </div>

      {/* How Knowledge Works */}
      <div
        style={{
          padding: "16px 20px",
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          marginBottom: "24px",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "10px", color: "#1e293b" }}>
          How Knowledge is Used
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px", color: "#0369a1" }}>Skills</div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}>
              Structured facts injected into prompts. Select in chat or configure defaults in Prompt Library.
            </p>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px", color: "#d97706" }}>Documents</div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}>
              Searched when skills don't have the answer. Results cited in Reasoning section.
            </p>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px", color: "#7c3aed" }}>Reference URLs</div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}>
              Fetched on-demand as fallback. Content summarized and cited in responses.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        <button
          onClick={() => { setActiveTab("skills"); setSelectedCategory(null); }}
          style={{
            ...styles.tab,
            ...(activeTab === "skills" ? styles.tabActive : {}),
          }}
        >
          <BookOpen size={18} />
          Skills
          <span style={{
            ...styles.tabCount,
            ...(activeTab === "skills" ? styles.tabCountActive : {}),
          }}>
            {tabCounts.skills}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab("documents"); setSelectedCategory(null); }}
          style={{
            ...styles.tab,
            ...(activeTab === "documents" ? styles.tabActive : {}),
          }}
        >
          <FileText size={18} />
          Documents
          <span style={{
            ...styles.tabCount,
            ...(activeTab === "documents" ? styles.tabCountActive : {}),
          }}>
            {tabCounts.documents}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab("urls"); setSelectedCategory(null); }}
          style={{
            ...styles.tab,
            ...(activeTab === "urls" ? styles.tabActive : {}),
          }}
        >
          <Globe size={18} />
          Reference URLs
          <span style={{
            ...styles.tabCount,
            ...(activeTab === "urls" ? styles.tabCountActive : {}),
          }}>
            {tabCounts.urls}
          </span>
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div style={styles.controls}>
        <div style={styles.searchBox}>
          <Search size={18} style={{ color: "#94a3b8" }} />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <X size={16} style={{ color: "#94a3b8" }} />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            style={{
              ...styles.filterButton,
              ...(selectedCategory ? styles.filterButtonActive : {}),
            }}
          >
            <Filter size={16} />
            {selectedCategory || "All Categories"}
            <ChevronDown size={16} />
          </button>

          {showCategoryDropdown && (
            <div style={styles.categoryDropdown}>
              <div
                style={styles.categoryOption}
                onClick={() => {
                  setSelectedCategory(null);
                  setShowCategoryDropdown(false);
                }}
              >
                <span>All Categories</span>
                {!selectedCategory && <span style={{ color: "#0ea5e9" }}>✓</span>}
              </div>
              {availableCategories.map((cat) => (
                <div
                  key={cat}
                  style={styles.categoryOption}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setShowCategoryDropdown(false);
                  }}
                >
                  <span>{cat}</span>
                  {selectedCategory === cat && <span style={{ color: "#0ea5e9" }}>✓</span>}
                </div>
              ))}
              {availableCategories.length === 0 && (
                <div style={{ ...styles.categoryOption, color: "#94a3b8" }}>
                  No categories available
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
          {activeTab === "skills" && (
            <Link
              href="/knowledge"
              style={{
                padding: "10px 16px",
                backgroundColor: "#0ea5e9",
                color: "#fff",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              + Add Skill
            </Link>
          )}
          {activeTab === "documents" && (
            <Link
              href="/knowledge/documents"
              style={{
                padding: "10px 16px",
                backgroundColor: "#0ea5e9",
                color: "#fff",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              + Upload Document
            </Link>
          )}
          {activeTab === "urls" && (
            <Link
              href="/knowledge/urls"
              style={{
                padding: "10px 16px",
                backgroundColor: "#0ea5e9",
                color: "#fff",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              + Add URL
            </Link>
          )}
        </div>
      </div>

      {/* Results */}
      {filteredItems.length === 0 ? (
        <div style={styles.emptyState}>
          {getTypeIcon(activeTab)}
          <p style={{ color: "#64748b", marginTop: "12px", marginBottom: "4px" }}>
            {searchQuery || selectedCategory
              ? `No ${activeTab} found matching your filters`
              : `No ${activeTab} added yet`}
          </p>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            {activeTab === "skills" && "Build skills from URLs to capture your organization's knowledge"}
            {activeTab === "documents" && "Upload PDFs, Word docs, or text files as reference material"}
            {activeTab === "urls" && "Add external URLs like your trust center or security docs"}
          </p>
        </div>
      ) : (
        <div>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "16px" }}>
            Showing {filteredItems.length} {activeTab}
            {selectedCategory && ` in "${selectedCategory}"`}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
          {filteredItems.map(renderItemCard)}
        </div>
      )}
    </div>
  );
}
