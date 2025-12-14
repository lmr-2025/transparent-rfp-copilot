"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  Filter,
  FileText,
  Globe,
  BookOpen,
  ChevronDown,
  X,
  Loader2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Skill, SourceUrl, SkillOwner, SkillHistoryEntry } from "@/types/skill";
import { KnowledgeDocument } from "@/types/document";
import { ReferenceUrl } from "@/types/referenceUrl";
import { CustomerProfile } from "@/types/customerProfile";
import { loadSkillsFromApi, updateSkillViaApi, deleteSkillViaApi } from "@/lib/skillStorage";
import { loadCategories } from "@/lib/categoryStorage";
import { LibraryRecommendation, AnalyzeLibraryResponse } from "@/types/libraryAnalysis";
import { SelectableUser } from "@/components/UserSelector";

// Import extracted components and types
import { styles } from "./styles";
import {
  TabType,
  LibraryItem,
  CategoryItem,
  LibraryAnalysisState,
  MergePreviewState,
  OwnerEditState,
  createAnalysisState,
} from "./types";
import LibraryItemCard, { getTypeIcon } from "./components/LibraryItemCard";
import MergePreviewModal from "./components/MergePreviewModal";
import LibraryAnalysisPanel, { AnalysisTransparencyModal } from "./components/LibraryAnalysisPanel";
import BulkActionsBar from "./components/BulkActionsBar";

function UnifiedLibraryContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const highlightId = searchParams.get("highlight") || searchParams.get("skill");
  const tabParam = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(tabParam || "skills");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightId);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Data states
  const [skills, setSkills] = useState<Skill[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [urls, setUrls] = useState<ReferenceUrl[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Library analysis state
  const [analysisState, setAnalysisState] = useState<LibraryAnalysisState>(createAnalysisState);

  // Merge preview state
  const [mergePreview, setMergePreview] = useState<MergePreviewState | null>(null);

  // Owner management state
  const [ownerEdit, setOwnerEdit] = useState<OwnerEditState>({
    skillId: null,
    isSelecting: false,
    isSaving: false,
  });

  // Multi-select state for bulk operations
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState<"none" | "assignOwner" | "refresh">("none");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Check if current user can edit/delete a skill (owner check)
  const canEditSkill = (skill: Skill): boolean => {
    if (!skill.owners || skill.owners.length === 0) return true;
    const currentUserEmail = session?.user?.email;
    const currentUserId = session?.user?.id;
    if (!currentUserEmail && !currentUserId) return false;
    return skill.owners.some(owner =>
      (owner.userId && owner.userId === currentUserId) ||
      (owner.email && currentUserEmail && owner.email.toLowerCase() === currentUserEmail.toLowerCase())
    );
  };

  // Convert data to unified items
  const libraryItems = useMemo((): LibraryItem[] => {
    const items: LibraryItem[] = [];

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

    customers.forEach((customer) => {
      items.push({
        id: customer.id,
        title: customer.name,
        description: customer.overview?.slice(0, 200),
        categories: customer.tags || [],
        type: "customers",
        createdAt: customer.createdAt,
        customerData: customer,
      });
    });

    return items;
  }, [skills, documents, urls, customers]);

  // Filter items by tab, search, and category
  const filteredItems = useMemo(() => {
    return libraryItems.filter((item) => {
      if (item.type !== activeTab) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDescription = item.description?.toLowerCase().includes(query);
        const matchesCategories = item.categories.some(c => c.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDescription && !matchesCategories) return false;
      }
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
    customers: customers.length,
  }), [skills, documents, urls, customers]);

  // Get unique categories from current tab items
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    libraryItems
      .filter(item => item.type === activeTab)
      .forEach(item => item.categories.forEach(c => cats.add(c)));
    return Array.from(cats).sort();
  }, [libraryItems, activeTab]);

  const visibleRecommendations = analysisState.recommendations.filter(
    (_, idx) => !analysisState.dismissedIds.has(String(idx))
  );

  // Multi-select helpers
  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkillIds(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const selectAllVisibleSkills = () => {
    const visibleSkillIds = filteredItems
      .filter(item => item.type === "skills")
      .map(item => item.id);
    setSelectedSkillIds(new Set(visibleSkillIds));
  };

  const clearSelection = () => {
    setSelectedSkillIds(new Set());
    setBulkActionMode("none");
  };

  const getEditableSelectedSkills = (): Skill[] => {
    return skills.filter(skill =>
      selectedSkillIds.has(skill.id) && canEditSkill(skill)
    );
  };

  // Handle URL params for highlighting and tab switching
  useEffect(() => {
    if (highlightId) {
      setHighlightedId(highlightId);
      setExpandedItems(new Set([highlightId]));
      if (tabParam === "documents") setActiveTab("documents");
      else if (tabParam === "urls") setActiveTab("urls");
    }
  }, [highlightId, tabParam]);

  // Scroll to highlighted item after data loads
  useEffect(() => {
    if (highlightedId && !isLoading && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedId, isLoading]);

  // Load all data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const skillsData = await loadSkillsFromApi();
        setSkills(skillsData);

        const docsResponse = await fetch("/api/documents");
        if (docsResponse.ok) {
          const docsData = await docsResponse.json();
          setDocuments(docsData.documents || []);
        }

        const urlsResponse = await fetch("/api/reference-urls");
        if (urlsResponse.ok) {
          const urlsData = await urlsResponse.json();
          setUrls(urlsData || []);
        }

        const customersResponse = await fetch("/api/customers");
        if (customersResponse.ok) {
          const customersData = await customersResponse.json();
          setCustomers(customersData.profiles || []);
        }

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

  // Library analysis handlers
  const handleAnalyzeLibrary = async () => {
    setAnalysisState(prev => ({ ...prev, isAnalyzing: true, error: null, showPanel: true }));
    try {
      const skillSummaries = skills.map(skill => ({
        id: skill.id,
        title: skill.title,
        tags: skill.tags,
        contentPreview: skill.content.substring(0, 500),
      }));

      const response = await fetch("/api/skills/analyze-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: skillSummaries }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze library");
      }

      const result = await response.json() as AnalyzeLibraryResponse;
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        recommendations: result.recommendations || [],
        summary: result.summary || "",
        healthScore: result.healthScore || 0,
        transparency: result.transparency || null,
      }));
    } catch (error) {
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : "Analysis failed",
      }));
    }
  };

  const dismissRecommendation = (index: number) => {
    setAnalysisState(prev => {
      const newDismissed = new Set(prev.dismissedIds);
      newDismissed.add(String(index));
      return { ...prev, dismissedIds: newDismissed };
    });
  };

  // Merge handlers
  const handleMergeSkills = async (rec: LibraryRecommendation, recIndex: number) => {
    if (rec.affectedSkillIds.length < 2) {
      alert("Need at least 2 skills to merge");
      return;
    }

    const affectedSkills = rec.affectedSkillIds
      .map(id => skills.find(s => s.id === id))
      .filter((s): s is Skill => s !== undefined);

    if (affectedSkills.length < 2) {
      alert("Could not find all affected skills");
      return;
    }

    const sortedSkills = [...affectedSkills].sort((a, b) => b.content.length - a.content.length);
    const targetSkill = sortedSkills[0];
    const skillsToMerge = sortedSkills.slice(1);

    const allTags = Array.from(new Set([
      ...targetSkill.tags,
      ...skillsToMerge.flatMap(s => s.tags),
    ]));

    const seenUrls = new Set<string>();
    const allSourceUrls: SourceUrl[] = [];
    for (const skill of [targetSkill, ...skillsToMerge]) {
      for (const srcUrl of (skill.sourceUrls || [])) {
        const normalizedUrl = srcUrl.url.toLowerCase().replace(/\/+$/, "");
        if (!seenUrls.has(normalizedUrl)) {
          seenUrls.add(normalizedUrl);
          allSourceUrls.push(srcUrl);
        }
      }
    }

    const seenOwnerNames = new Set<string>();
    const allOwners: SkillOwner[] = [];
    for (const skill of [targetSkill, ...skillsToMerge]) {
      for (const owner of (skill.owners || [])) {
        if (!seenOwnerNames.has(owner.name)) {
          seenOwnerNames.add(owner.name);
          allOwners.push(owner);
        }
      }
    }

    setMergePreview({
      recIndex,
      targetSkill,
      skillsToMerge,
      mergedTitle: targetSkill.title,
      mergedContent: "",
      mergedTags: allTags,
      mergedSourceUrls: allSourceUrls,
      mergedOwners: allOwners,
      isGenerating: true,
      isSaving: false,
      error: null,
    });

    try {
      const response = await fetch("/api/skills/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSkill: { title: targetSkill.title, content: targetSkill.content },
          skillsToMerge: skillsToMerge.map(s => ({ title: s.title, content: s.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate merged content");
      }

      const result = await response.json();
      setMergePreview(prev => prev ? {
        ...prev,
        mergedTitle: result.title || prev.mergedTitle,
        mergedContent: result.content,
        isGenerating: false,
      } : null);
    } catch (error) {
      const fallbackContent = [
        targetSkill.content,
        "",
        "---",
        "",
        ...skillsToMerge.map(s => `## ${s.title}\n\n${s.content}`),
      ].join("\n");

      setMergePreview(prev => prev ? {
        ...prev,
        mergedContent: fallbackContent,
        isGenerating: false,
        error: `AI merge failed, showing concatenated content. (${error instanceof Error ? error.message : "Unknown error"})`,
      } : null);
    }
  };

  const saveMergedSkill = async () => {
    if (!mergePreview) return;

    setMergePreview(prev => prev ? { ...prev, isSaving: true } : null);

    try {
      const { targetSkill, skillsToMerge, mergedTitle, mergedContent, mergedTags, mergedSourceUrls, mergedOwners, recIndex } = mergePreview;

      const now = new Date().toISOString();
      const mergeHistory: SkillHistoryEntry = {
        date: now,
        action: "updated",
        summary: `Merged with: ${skillsToMerge.map(s => s.title).join(", ")}`,
      };

      const updatedTarget = await updateSkillViaApi(targetSkill.id, {
        title: mergedTitle,
        content: mergedContent,
        tags: mergedTags,
        sourceUrls: mergedSourceUrls,
        owners: mergedOwners,
        lastRefreshedAt: now,
        history: [...(targetSkill.history || []), mergeHistory],
      });

      for (const skill of skillsToMerge) {
        await deleteSkillViaApi(skill.id);
      }

      setSkills(prev => {
        const mergedIds = new Set(skillsToMerge.map(s => s.id));
        return prev
          .filter(s => !mergedIds.has(s.id))
          .map(s => s.id === targetSkill.id ? updatedTarget : s);
      });

      dismissRecommendation(recIndex);
      setMergePreview(null);
      alert(`Successfully merged ${skillsToMerge.length} skill${skillsToMerge.length > 1 ? "s" : ""} into "${updatedTarget.title}"`);
    } catch (error) {
      console.error("Failed to merge skills:", error);
      alert(`Failed to merge skills: ${error instanceof Error ? error.message : "Unknown error"}`);
      setMergePreview(prev => prev ? { ...prev, isSaving: false } : null);
    }
  };

  // Owner management handlers
  const startSelectingOwner = (skillId: string) => {
    setOwnerEdit({ skillId, isSelecting: true, isSaving: false });
  };

  const cancelSelectingOwner = () => {
    setOwnerEdit({ skillId: null, isSelecting: false, isSaving: false });
  };

  const handleSelectOwner = async (skillId: string, selectedUser: SelectableUser) => {
    setOwnerEdit(prev => ({ ...prev, isSaving: true }));
    try {
      const skill = skills.find(s => s.id === skillId);
      if (!skill) throw new Error("Skill not found");

      const newOwner: SkillOwner = {
        userId: selectedUser.id,
        name: selectedUser.name || selectedUser.email || "Unknown",
        email: selectedUser.email || undefined,
        image: selectedUser.image || undefined,
      };

      const existingOwners = skill.owners || [];
      const isDuplicate = existingOwners.some(o =>
        (o.userId && o.userId === newOwner.userId) ||
        (o.email && newOwner.email && o.email.toLowerCase() === newOwner.email.toLowerCase())
      );

      if (isDuplicate) {
        alert("This user is already an owner of this skill");
        setOwnerEdit(prev => ({ ...prev, isSaving: false }));
        return;
      }

      const now = new Date().toISOString();
      const historyEntry: SkillHistoryEntry = {
        date: now,
        action: "owner_added",
        summary: `Added owner: ${newOwner.name}`,
      };

      const updatedSkill = await updateSkillViaApi(skillId, {
        owners: [...existingOwners, newOwner],
        history: [...(skill.history || []), historyEntry],
      });

      setSkills(prev => prev.map(s => s.id === skillId ? updatedSkill : s));
      cancelSelectingOwner();
    } catch (error) {
      console.error("Failed to add owner:", error);
      alert(`Failed to add owner: ${error instanceof Error ? error.message : "Unknown error"}`);
      setOwnerEdit(prev => ({ ...prev, isSaving: false }));
    }
  };

  const handleRemoveOwner = async (skillId: string, owner: SkillOwner) => {
    if (!confirm(`Remove "${owner.name}" as an owner of this skill?`)) return;
    try {
      const skill = skills.find(s => s.id === skillId);
      if (!skill) throw new Error("Skill not found");

      const updatedOwners = (skill.owners || []).filter(o => {
        if (owner.userId && o.userId) return o.userId !== owner.userId;
        return o.name.toLowerCase() !== owner.name.toLowerCase();
      });

      const now = new Date().toISOString();
      const historyEntry: SkillHistoryEntry = {
        date: now,
        action: "owner_removed",
        summary: `Removed owner: ${owner.name}`,
      };

      const updatedSkill = await updateSkillViaApi(skillId, {
        owners: updatedOwners,
        history: [...(skill.history || []), historyEntry],
      });

      setSkills(prev => prev.map(s => s.id === skillId ? updatedSkill : s));
    } catch (error) {
      console.error("Failed to remove owner:", error);
      alert(`Failed to remove owner: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Bulk action handlers
  const handleBulkAssignOwner = async (selectedUser: SelectableUser) => {
    const editableSkills = getEditableSelectedSkills();
    if (editableSkills.length === 0) {
      alert("No editable skills selected. You can only edit skills you own or skills without owners.");
      return;
    }

    setBulkActionLoading(true);
    const now = new Date().toISOString();
    let successCount = 0;
    let errorCount = 0;

    for (const skill of editableSkills) {
      try {
        const newOwner: SkillOwner = {
          userId: selectedUser.id,
          name: selectedUser.name || selectedUser.email || "Unknown",
          email: selectedUser.email || undefined,
          image: selectedUser.image || undefined,
        };

        const existingOwners = skill.owners || [];
        const isDuplicate = existingOwners.some(o =>
          (o.userId && o.userId === newOwner.userId) ||
          (o.email && newOwner.email && o.email.toLowerCase() === newOwner.email.toLowerCase())
        );

        if (isDuplicate) continue;

        const historyEntry: SkillHistoryEntry = {
          date: now,
          action: "owner_added",
          summary: `Added owner: ${newOwner.name}`,
        };

        const updatedSkill = await updateSkillViaApi(skill.id, {
          owners: [...existingOwners, newOwner],
          history: [...(skill.history || []), historyEntry],
        });

        setSkills(prev => prev.map(s => s.id === skill.id ? updatedSkill : s));
        successCount++;
      } catch (error) {
        console.error(`Failed to update skill ${skill.title}:`, error);
        errorCount++;
      }
    }

    setBulkActionLoading(false);
    setBulkActionMode("none");
    clearSelection();

    if (successCount > 0) {
      alert(`Successfully assigned ${selectedUser.name} as owner to ${successCount} skill(s).${errorCount > 0 ? ` ${errorCount} failed.` : ""}`);
    } else if (errorCount > 0) {
      alert(`Failed to update ${errorCount} skill(s).`);
    }
  };

  const handleBulkRefresh = async () => {
    const editableSkills = getEditableSelectedSkills();
    if (editableSkills.length === 0) {
      alert("No editable skills selected. You can only refresh skills you own or skills without owners.");
      return;
    }

    const refreshableSkills = editableSkills.filter(s => s.sourceUrls && s.sourceUrls.length > 0);
    if (refreshableSkills.length === 0) {
      alert("None of the selected skills have source URLs to refresh from.");
      return;
    }

    if (!confirm(`Refresh ${refreshableSkills.length} skill(s) from their source URLs? This may take a while.`)) {
      return;
    }

    setBulkActionLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const skill of refreshableSkills) {
      try {
        const response = await fetch("/api/skills/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: skill.sourceUrls?.map(s => s.url) || [],
            existingSkillId: skill.id,
          }),
        });

        if (response.ok) {
          const refreshedSkill = await response.json();
          setSkills(prev => prev.map(s => s.id === skill.id ? refreshedSkill : s));
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Failed to refresh skill ${skill.title}:`, error);
        errorCount++;
      }
    }

    setBulkActionLoading(false);
    setBulkActionMode("none");
    clearSelection();
    alert(`Refreshed ${successCount} skill(s).${errorCount > 0 ? ` ${errorCount} failed.` : ""}`);
  };

  // Delete handlers
  const handleDelete = async (type: TabType, id: string, title: string) => {
    if (type === "skills") {
      if (!confirm(`Are you sure you want to delete the skill "${title}"? This cannot be undone.`)) return;
      try {
        await deleteSkillViaApi(id);
        setSkills(skills.filter(s => s.id !== id));
      } catch (error) {
        console.error("Failed to delete skill:", error);
        alert(`Failed to delete skill: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } else if (type === "documents") {
      if (!confirm("Are you sure you want to delete this document?")) return;
      try {
        const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
        if (response.ok) setDocuments(documents.filter(d => d.id !== id));
      } catch (error) {
        console.error("Failed to delete document:", error);
      }
    } else if (type === "urls") {
      if (!confirm("Are you sure you want to delete this URL?")) return;
      try {
        const response = await fetch(`/api/reference-urls/${id}`, { method: "DELETE" });
        if (response.ok) setUrls(urls.filter(u => u.id !== id));
      } catch (error) {
        console.error("Failed to delete URL:", error);
      }
    } else if (type === "customers") {
      if (!confirm(`Are you sure you want to delete the customer profile "${title}"?`)) return;
      try {
        const response = await fetch(`/api/customers/${id}`, { method: "DELETE" });
        if (response.ok) setCustomers(customers.filter(c => c.id !== id));
      } catch (error) {
        console.error("Failed to delete customer:", error);
      }
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
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
      <div style={{
        padding: "16px 20px",
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        marginBottom: "24px",
      }}>
        <div style={{ fontWeight: 600, marginBottom: "10px", color: "#1e293b" }}>
          How Knowledge is Used
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px", color: "#0369a1" }}>Skills</div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}>
              Structured facts injected into prompts. Select in chat or configure defaults.
            </p>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px", color: "#d97706" }}>Documents</div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}>
              Searched when skills don&apos;t have the answer. Results cited in responses.
            </p>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px", color: "#7c3aed" }}>Reference URLs</div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}>
              Fetched on-demand as fallback. Content summarized and cited.
            </p>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: "0.9rem", marginBottom: "4px", color: "#db2777" }}>Customers</div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}>
              Select profiles for personalized, customer-specific responses.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        {(["skills", "documents", "urls", "customers"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedCategory(null); }}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
          >
            {tab === "skills" && <BookOpen size={18} />}
            {tab === "documents" && <FileText size={18} />}
            {tab === "urls" && <Globe size={18} />}
            {tab === "customers" && <Users size={18} />}
            {tab === "skills" ? "Skills" : tab === "documents" ? "Documents" : tab === "urls" ? "Reference URLs" : "Customers"}
            <span style={{
              ...styles.tabCount,
              ...(activeTab === tab ? styles.tabCountActive : {}),
            }}>
              {tabCounts[tab]}
            </span>
          </button>
        ))}
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
                onClick={() => { setSelectedCategory(null); setShowCategoryDropdown(false); }}
              >
                <span>All Categories</span>
                {!selectedCategory && <span style={{ color: "#0ea5e9" }}>✓</span>}
              </div>
              {availableCategories.map((cat) => (
                <div
                  key={cat}
                  style={styles.categoryOption}
                  onClick={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
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
            <>
              <button
                type="button"
                onClick={handleAnalyzeLibrary}
                disabled={analysisState.isAnalyzing || skills.length < 2}
                style={{
                  padding: "10px 16px",
                  backgroundColor: analysisState.isAnalyzing || skills.length < 2 ? "#94a3b8" : "#8b5cf6",
                  color: "#fff",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: analysisState.isAnalyzing || skills.length < 2 ? "not-allowed" : "pointer",
                }}
                title={skills.length < 2 ? `Need at least 2 skills to analyze (currently ${skills.length})` : "Review library for merge opportunities and organization issues"}
              >
                {analysisState.isAnalyzing ? "Analyzing..." : "Review & Merge"}
              </button>
              <Link
                href="/knowledge/add"
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
            </>
          )}
          {activeTab === "documents" && (
            <Link href="/knowledge/documents" style={{ padding: "10px 16px", backgroundColor: "#0ea5e9", color: "#fff", borderRadius: "8px", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              + Upload Document
            </Link>
          )}
          {activeTab === "urls" && (
            <Link href="/knowledge/urls" style={{ padding: "10px 16px", backgroundColor: "#0ea5e9", color: "#fff", borderRadius: "8px", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              + Add URL
            </Link>
          )}
          {activeTab === "customers" && (
            <Link href="/customers/add" style={{ padding: "10px 16px", backgroundColor: "#0ea5e9", color: "#fff", borderRadius: "8px", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              + Add Customer
            </Link>
          )}
        </div>
      </div>

      {/* Library Analysis Panel */}
      {analysisState.showPanel && activeTab === "skills" && (
        <LibraryAnalysisPanel
          analysisState={analysisState}
          onClose={() => setAnalysisState(createAnalysisState)}
          onShowTransparencyModal={() => setAnalysisState(prev => ({ ...prev, showTransparencyModal: true }))}
          onDismissRecommendation={dismissRecommendation}
          onMergeSkills={handleMergeSkills}
          visibleRecommendations={visibleRecommendations}
        />
      )}

      {/* Transparency Modal */}
      {analysisState.showTransparencyModal && analysisState.transparency && (
        <AnalysisTransparencyModal
          analysisState={analysisState}
          onClose={() => setAnalysisState(prev => ({ ...prev, showTransparencyModal: false }))}
        />
      )}

      {/* Merge Preview Modal */}
      {mergePreview && (
        <MergePreviewModal
          mergePreview={mergePreview}
          onClose={() => setMergePreview(null)}
          onUpdateTitle={(title) => setMergePreview(prev => prev ? { ...prev, mergedTitle: title } : null)}
          onUpdateContent={(content) => setMergePreview(prev => prev ? { ...prev, mergedContent: content } : null)}
          onRemoveTag={(index) => setMergePreview(prev => prev ? { ...prev, mergedTags: prev.mergedTags.filter((_, i) => i !== index) } : null)}
          onSave={saveMergedSkill}
        />
      )}

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
            {activeTab === "customers" && "Build customer profiles from websites and documents for personalized responses"}
          </p>
        </div>
      ) : (
        <div>
          {/* Bulk Actions Bar */}
          <BulkActionsBar
            activeTab={activeTab}
            filteredItems={filteredItems}
            selectedSkillIds={selectedSkillIds}
            bulkActionMode={bulkActionMode}
            bulkActionLoading={bulkActionLoading}
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
            onSelectAll={() => {
              if (selectedSkillIds.size === filteredItems.filter(i => i.type === "skills").length) {
                clearSelection();
              } else {
                selectAllVisibleSkills();
              }
            }}
            onClearSelection={clearSelection}
            onSetBulkActionMode={setBulkActionMode}
            onBulkRefresh={handleBulkRefresh}
            onBulkAssignOwner={handleBulkAssignOwner}
          />

          {/* Item Cards */}
          {filteredItems.map((item) => (
            <LibraryItemCard
              key={item.id}
              item={item}
              isExpanded={expandedItems.has(item.id)}
              isHighlighted={highlightedId === item.id}
              isSelected={selectedSkillIds.has(item.id)}
              highlightRef={highlightedId === item.id ? highlightRef : undefined}
              ownerEdit={ownerEdit}
              onToggleExpand={toggleExpand}
              onToggleSelect={toggleSkillSelection}
              onDelete={handleDelete}
              onStartSelectingOwner={startSelectingOwner}
              onCancelSelectingOwner={cancelSelectingOwner}
              onSelectOwner={handleSelectOwner}
              onRemoveOwner={handleRemoveOwner}
              canEditSkill={canEditSkill}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function UnifiedLibraryPage() {
  return (
    <Suspense fallback={
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Loader2 size={40} className="animate-spin" style={{ color: "#0ea5e9", margin: "0 auto 16px" }} />
          <p style={{ color: "#64748b" }}>Loading library...</p>
        </div>
      </div>
    }>
      <UnifiedLibraryContent />
    </Suspense>
  );
}
