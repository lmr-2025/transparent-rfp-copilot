"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { loadSkillsFromApi } from "@/lib/skillStorage";
import { Skill } from "@/types/skill";
import { fetchActiveProfiles } from "@/lib/customerProfileApi";
import { CustomerProfile } from "@/types/customerProfile";
import {
  ChatPrompt,
  getAllPrompts,
  addUserPrompt,
  deleteUserPrompt,
  getEffectiveCategories,
  CategoryConfig,
} from "@/lib/chatPromptLibrary";
import {
  defaultChatSections,
  EditableChatSection,
  buildChatPromptFromSections,
} from "@/lib/promptSections";
import { CHAT_PROMPT_SECTIONS_KEY } from "@/lib/promptStorage";
import { CLAUDE_MODEL } from "@/lib/config";
import TransparencyModal from "@/components/TransparencyModal";

type TransparencyData = {
  systemPrompt: string;
  knowledgeContext: string;
  customerContext: string;
  model: string;
  maxTokens: number;
  temperature: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  skillsUsed?: { id: string; title: string }[];
  customersUsed?: { id: string; name: string }[];
  transparency?: TransparencyData;
};

type SkillSelection = {
  id: string;
  title: string;
  selected: boolean;
  tags: string[];
};

type CustomerSelection = {
  id: string;
  name: string;
  industry?: string;
  selected: boolean;
};

type SidebarTab = "skills" | "prompts" | "customers";

// Helper to load chat sections from localStorage
const loadChatSections = (): EditableChatSection[] => {
  if (typeof window === "undefined") {
    return defaultChatSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));
  }
  try {
    const raw = window.localStorage.getItem(CHAT_PROMPT_SECTIONS_KEY);
    if (!raw) {
      return defaultChatSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));
    }
    const parsed = JSON.parse(raw) as EditableChatSection[];
    if (!Array.isArray(parsed)) {
      return defaultChatSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));
    }
    return parsed.map(section => ({
      ...section,
      enabled: section.enabled ?? true,
      text: section.text ?? section.defaultText ?? "",
    }));
  } catch {
    return defaultChatSections.map(s => ({ ...s, text: s.defaultText, enabled: true }));
  }
};

const styles = {
  container: {
    display: "flex",
    height: "calc(100vh - 60px)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  sidebar: {
    width: "300px",
    borderRight: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  sidebarTabs: {
    display: "flex",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#fff",
  },
  sidebarTab: {
    flex: 1,
    padding: "12px 16px",
    border: "none",
    backgroundColor: "transparent",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    color: "#64748b",
    borderBottom: "2px solid transparent",
    transition: "all 0.15s ease",
  },
  sidebarTabActive: {
    color: "#3b82f6",
    borderBottomColor: "#3b82f6",
    backgroundColor: "#f8fafc",
  },
  sidebarHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#fff",
  },
  sidebarContent: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "12px",
  },
  skillItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "10px 12px",
    marginBottom: "8px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  skillItemSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#fff",
  },
  chatHeader: {
    padding: "16px 24px",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#fff",
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "24px",
  },
  messageWrapper: {
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column" as const,
  },
  userMessage: {
    alignSelf: "flex-end",
    maxWidth: "70%",
    padding: "12px 16px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    borderRadius: "16px 16px 4px 16px",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    maxWidth: "80%",
    padding: "12px 16px",
    backgroundColor: "#f1f5f9",
    color: "#1e293b",
    borderRadius: "16px 16px 16px 4px",
  },
  inputArea: {
    padding: "16px 24px",
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#fff",
  },
  inputWrapper: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    padding: "12px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    fontSize: "15px",
    resize: "none" as const,
    minHeight: "48px",
    maxHeight: "150px",
    fontFamily: "inherit",
  },
  sendButton: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  skillsUsedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 500,
    marginTop: "8px",
    marginRight: "4px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#64748b",
    textAlign: "center" as const,
    padding: "40px",
  },
  tag: {
    display: "inline-block",
    padding: "2px 6px",
    backgroundColor: "#e2e8f0",
    color: "#64748b",
    borderRadius: "4px",
    fontSize: "10px",
    marginRight: "4px",
    marginTop: "4px",
  },
  promptItem: {
    padding: "10px 12px",
    marginBottom: "8px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  promptCategory: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 600,
    marginBottom: "6px",
  },
};

export default function ChatPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillSelections, setSkillSelections] = useState<SkillSelection[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [customerSelections, setCustomerSelections] = useState<CustomerSelection[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("prompts");
  const [prompts, setPrompts] = useState<ChatPrompt[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [promptFilter, setPromptFilter] = useState<string>("all");
  const [showTransparency, setShowTransparency] = useState(false);
  const [selectedTransparency, setSelectedTransparency] = useState<TransparencyData | null>(null);
  const [showPreviewPrompt, setShowPreviewPrompt] = useState(false);
  const [chatSections] = useState<EditableChatSection[]>(() => loadChatSections());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load skills, customer profiles, and prompts on mount
  useEffect(() => {
    loadSkillsFromApi().then((loaded) => {
      const activeSkills = loaded.filter(s => s.isActive);
      setSkills(activeSkills);
      setSkillSelections(
        activeSkills.map(s => ({
          id: s.id,
          title: s.title,
          tags: s.tags,
          selected: true,
        }))
      );
    }).catch(console.error);
    setPrompts(getAllPrompts());
    setCategories(getEffectiveCategories());

    // Load customer profiles from database
    fetchActiveProfiles()
      .then(profiles => {
        setCustomerProfiles(profiles);
        setCustomerSelections(
          profiles.map(p => ({
            id: p.id,
            name: p.name,
            industry: p.industry || undefined,
            selected: false, // Default to none selected
          }))
        );
      })
      .catch(err => {
        console.error("Failed to load customer profiles:", err);
      });
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "48px";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [inputValue]);

  const toggleSkill = (skillId: string) => {
    setSkillSelections(prev =>
      prev.map(s => (s.id === skillId ? { ...s, selected: !s.selected } : s))
    );
  };

  const selectAll = () => {
    setSkillSelections(prev => prev.map(s => ({ ...s, selected: true })));
  };

  const selectNone = () => {
    setSkillSelections(prev => prev.map(s => ({ ...s, selected: false })));
  };

  const selectedCount = skillSelections.filter(s => s.selected).length;

  // Customer selection helpers
  const toggleCustomer = (customerId: string) => {
    setCustomerSelections(prev =>
      prev.map(c => (c.id === customerId ? { ...c, selected: !c.selected } : c))
    );
  };

  const selectAllCustomers = () => {
    setCustomerSelections(prev => prev.map(c => ({ ...c, selected: true })));
  };

  const selectNoCustomers = () => {
    setCustomerSelections(prev => prev.map(c => ({ ...c, selected: false })));
  };

  const selectedCustomerCount = customerSelections.filter(c => c.selected).length;

  const handleSend = async (promptOverride?: string) => {
    const messageContent = promptOverride || inputValue.trim();
    if (!messageContent || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const selectedSkillIds = new Set(skillSelections.filter(s => s.selected).map(s => s.id));
      const selectedSkills = skills
        .filter(s => selectedSkillIds.has(s.id))
        .map(s => ({
          id: s.id,
          title: s.title,
          content: s.content,
          tags: s.tags,
        }));

      const selectedCustomerIds = new Set(customerSelections.filter(c => c.selected).map(c => c.id));
      const selectedCustomers = customerProfiles
        .filter(p => selectedCustomerIds.has(p.id))
        .map(p => ({
          id: p.id,
          name: p.name,
          industry: p.industry || undefined,
          overview: p.overview,
          products: p.products || undefined,
          challenges: p.challenges || undefined,
          keyFacts: p.keyFacts,
        }));

      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/knowledge-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          skills: selectedSkills,
          customerProfiles: selectedCustomers,
          conversationHistory,
          chatSections: chatSections.filter(s => s.enabled),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        skillsUsed: data.skillsUsed,
        customersUsed: data.customersUsed,
        transparency: data.transparency,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-show transparency for the first message
      if (messages.length === 0 && data.transparency) {
        setSelectedTransparency(data.transparency);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const applyPrompt = (prompt: ChatPrompt) => {
    setInputValue(prompt.prompt);
    textareaRef.current?.focus();
  };

  const handleSavePrompt = () => {
    if (!newPromptTitle.trim() || !inputValue.trim()) return;
    addUserPrompt(newPromptTitle.trim(), inputValue.trim());
    setPrompts(getAllPrompts());
    setNewPromptTitle("");
    setShowSavePrompt(false);
  };

  const handleDeletePrompt = (id: string) => {
    if (deleteUserPrompt(id)) {
      setPrompts(getAllPrompts());
    }
  };

  const filteredPrompts = promptFilter === "all"
    ? prompts
    : prompts.filter(p => p.category === promptFilter);

  // Generate preview of what will be sent to the API
  const getPreviewPrompt = (): TransparencyData => {
    const selectedSkillIds = new Set(skillSelections.filter(s => s.selected).map(s => s.id));
    const selectedSkills = skills.filter(s => selectedSkillIds.has(s.id));

    const knowledgeContext = selectedSkills.length > 0
      ? selectedSkills.map((skill, idx) =>
          `=== KNOWLEDGE SOURCE ${idx + 1}: ${skill.title} ===\nTags: ${skill.tags.join(", ") || "none"}\n\n${skill.content}`
        ).join("\n\n---\n\n")
      : "No knowledge base documents provided.";

    // Build customer context
    const selectedCustomerIds = new Set(customerSelections.filter(c => c.selected).map(c => c.id));
    const selectedCustomers = customerProfiles.filter(p => selectedCustomerIds.has(p.id));

    const customerContext = selectedCustomers.length > 0
      ? selectedCustomers.map((profile) => {
          const keyFactsText = profile.keyFacts.length > 0
            ? `Key Facts:\n${profile.keyFacts.map(f => `  - ${f.label}: ${f.value}`).join("\n")}`
            : "";
          return `=== CUSTOMER PROFILE: ${profile.name} ===
Industry: ${profile.industry || "Not specified"}

Overview:
${profile.overview}
${profile.products ? `\nProducts & Services:\n${profile.products}` : ""}
${profile.challenges ? `\nChallenges & Needs:\n${profile.challenges}` : ""}
${keyFactsText}`;
        }).join("\n\n---\n\n")
      : "";

    // Build combined context
    const combinedKnowledgeContext = customerContext
      ? `${knowledgeContext}\n\n=== CUSTOMER INTELLIGENCE ===\n\n${customerContext}`
      : knowledgeContext;

    // Use configured chat sections from localStorage
    const systemPrompt = buildChatPromptFromSections(chatSections, combinedKnowledgeContext);

    return {
      systemPrompt,
      knowledgeContext,
      customerContext,
      model: CLAUDE_MODEL,
      maxTokens: 4000,
      temperature: 0.3,
    };
  };

  const groupedPrompts = filteredPrompts.reduce((acc, prompt) => {
    const category = prompt.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(prompt);
    return acc;
  }, {} as Record<string, ChatPrompt[]>);

  // Helper to get category config by id
  const getCategoryConfig = (id: string): CategoryConfig | undefined => {
    return categories.find(c => c.id === id);
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTabs}>
          <button
            onClick={() => setSidebarTab("prompts")}
            style={{
              ...styles.sidebarTab,
              ...(sidebarTab === "prompts" ? styles.sidebarTabActive : {}),
            }}
          >
            Prompts
          </button>
          <button
            onClick={() => setSidebarTab("skills")}
            style={{
              ...styles.sidebarTab,
              ...(sidebarTab === "skills" ? styles.sidebarTabActive : {}),
            }}
          >
            Skills ({selectedCount})
          </button>
          <button
            onClick={() => setSidebarTab("customers")}
            style={{
              ...styles.sidebarTab,
              ...(sidebarTab === "customers" ? styles.sidebarTabActive : {}),
            }}
          >
            Customers ({selectedCustomerCount})
          </button>
        </div>

        {sidebarTab === "customers" ? (
          <>
            <div style={styles.sidebarHeader}>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                {selectedCustomerCount} of {customerSelections.length} customer profiles selected
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={selectAllCustomers}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={selectNoCustomers}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Select None
                </button>
              </div>
            </div>
            <div style={styles.sidebarContent}>
              {customerSelections.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#64748b", textAlign: "center", marginTop: "20px" }}>
                  No customer profiles yet.{" "}
                  <a href="/customers" style={{ color: "#3b82f6" }}>Build one</a>
                </p>
              ) : (
                customerSelections.map(customer => (
                  <div
                    key={customer.id}
                    onClick={() => toggleCustomer(customer.id)}
                    style={{
                      ...styles.skillItem,
                      ...(customer.selected ? styles.skillItemSelected : {}),
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={customer.selected}
                      onChange={() => toggleCustomer(customer.id)}
                      style={{ marginTop: "2px" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#1e293b",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {customer.name}
                      </div>
                      {customer.industry && (
                        <span style={{
                          ...styles.tag,
                          backgroundColor: "#f0fdf4",
                          color: "#166534",
                        }}>
                          {customer.industry}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
              {/* Link to Customer Library */}
              <div style={{ padding: "12px 0", borderTop: "1px solid #e2e8f0", marginTop: "8px" }}>
                <Link
                  href="/customers/library"
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 500,
                    textAlign: "center",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  Manage profiles →
                </Link>
              </div>
            </div>
          </>
        ) : sidebarTab === "skills" ? (
          <>
            <div style={styles.sidebarHeader}>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                {selectedCount} of {skillSelections.length} skills selected as context
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={selectAll}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={selectNone}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Select None
                </button>
              </div>
            </div>
            <div style={styles.sidebarContent}>
              {skillSelections.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#64748b", textAlign: "center", marginTop: "20px" }}>
                  No skills yet.{" "}
                  <a href="/knowledge" style={{ color: "#3b82f6" }}>Add some</a>
                </p>
              ) : (
                skillSelections.map(skill => (
                  <div
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    style={{
                      ...styles.skillItem,
                      ...(skill.selected ? styles.skillItemSelected : {}),
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={skill.selected}
                      onChange={() => toggleSkill(skill.id)}
                      style={{ marginTop: "2px" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#1e293b",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {skill.title}
                      </div>
                      {skill.tags.length > 0 && (
                        <div style={{ marginTop: "4px" }}>
                          {skill.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} style={styles.tag}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div style={styles.sidebarHeader}>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#64748b" }}>
                Click a prompt to use it, or save your own
              </p>
              <select
                value={promptFilter}
                onChange={e => setPromptFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "4px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div style={styles.sidebarContent}>
              {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => {
                const catConfig = getCategoryConfig(category);
                const catLabel = catConfig?.label || category;
                const catColor = catConfig?.color || { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
                return (
                <div key={category} style={{ marginBottom: "16px" }}>
                  <div style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#64748b",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                    padding: "0 4px",
                  }}>
                    {catLabel}
                  </div>
                  {categoryPrompts.map(prompt => {
                    const promptCatConfig = getCategoryConfig(prompt.category);
                    const colors = promptCatConfig?.color || catColor;
                    return (
                      <div
                        key={prompt.id}
                        style={{
                          ...styles.promptItem,
                          borderLeftColor: colors.border,
                          borderLeftWidth: "3px",
                        }}
                        onClick={() => applyPrompt(prompt)}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = "#f8fafc";
                          e.currentTarget.style.borderColor = colors.border;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = "#fff";
                          e.currentTarget.style.borderColor = "#e2e8f0";
                          e.currentTarget.style.borderLeftColor = colors.border;
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#1e293b",
                              marginBottom: "4px",
                            }}>
                              {prompt.title}
                            </div>
                            <div style={{
                              fontSize: "11px",
                              color: "#64748b",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              lineHeight: 1.4,
                            }}>
                              {prompt.prompt}
                            </div>
                          </div>
                          {!prompt.isBuiltIn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePrompt(prompt.id);
                              }}
                              style={{
                                padding: "2px 6px",
                                fontSize: "10px",
                                backgroundColor: "transparent",
                                border: "none",
                                color: "#94a3b8",
                                cursor: "pointer",
                                marginLeft: "8px",
                              }}
                              title="Delete prompt"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
              })}
              {/* Link to Prompt Library */}
              <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", marginTop: "8px" }}>
                <Link
                  href="/prompts/library"
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: "#2563eb",
                    fontSize: "13px",
                    fontWeight: 500,
                    textAlign: "center",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  Browse all prompts →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Chat Area */}
      <div style={styles.chatArea}>
        <div style={styles.chatHeader}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#1e293b" }}>
                Chat with Knowledge Base
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                Ask questions about your security documentation and policies
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                Clear Chat
              </button>
            )}
          </div>
        </div>

        <div style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>💬</div>
              <h3 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>Start a Conversation</h3>
              <p style={{ maxWidth: "400px", lineHeight: 1.6 }}>
                Ask questions about your knowledge base, or use a prompt from the library to get started.
              </p>
              <div style={{ marginTop: "24px", display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                {prompts.slice(0, 3).map(prompt => {
                  const promptCat = getCategoryConfig(prompt.category);
                  const promptColor = promptCat?.color || { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
                  return (
                  <button
                    key={prompt.id}
                    onClick={() => applyPrompt(prompt)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "12px",
                      backgroundColor: promptColor.bg,
                      color: promptColor.text,
                      border: `1px solid ${promptColor.border}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    {prompt.title}
                  </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {messages.map(message => (
                <div key={message.id} style={styles.messageWrapper}>
                  <div
                    style={
                      message.role === "user"
                        ? styles.userMessage
                        : styles.assistantMessage
                    }
                  >
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {message.content}
                    </div>
                    {message.role === "assistant" && (
                      <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                        {message.skillsUsed && message.skillsUsed.length > 0 && message.skillsUsed.map(skill => (
                          <span key={skill.id} style={styles.skillsUsedBadge}>
                            📚 {skill.title}
                          </span>
                        ))}
                        {message.customersUsed && message.customersUsed.length > 0 && message.customersUsed.map(customer => (
                          <span key={customer.id} style={{
                            ...styles.skillsUsedBadge,
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                          }}>
                            🏢 {customer.name}
                          </span>
                        ))}
                        {message.transparency && (
                          <button
                            onClick={() => {
                              setSelectedTransparency(message.transparency!);
                              setShowTransparency(true);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              backgroundColor: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #86efac",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 500,
                              cursor: "pointer",
                            }}
                          >
                            🔍 View Prompt
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      marginTop: "4px",
                      alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={styles.messageWrapper}>
                  <div style={styles.assistantMessage}>
                    <div style={{ display: "flex", gap: "4px", padding: "4px 0" }}>
                      <span style={{ animation: "pulse 1.5s infinite", opacity: 0.6 }}>●</span>
                      <span style={{ animation: "pulse 1.5s infinite 0.3s", opacity: 0.6 }}>●</span>
                      <span style={{ animation: "pulse 1.5s infinite 0.6s", opacity: 0.6 }}>●</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {error && (
          <div style={{
            padding: "12px 24px",
            backgroundColor: "#fef2f2",
            borderTop: "1px solid #fecaca",
            color: "#dc2626",
            fontSize: "13px",
          }}>
            {error}
          </div>
        )}

        {/* Save Prompt Modal */}
        {showSavePrompt && (
          <div style={{
            padding: "12px 24px",
            backgroundColor: "#f0fdf4",
            borderTop: "1px solid #86efac",
          }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                value={newPromptTitle}
                onChange={e => setNewPromptTitle(e.target.value.slice(0, 200))}
                placeholder="Enter a name for this prompt..."
                maxLength={200}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #86efac",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              />
            <button
              onClick={handleSavePrompt}
              disabled={!newPromptTitle.trim()}
              style={{
                padding: "8px 16px",
                backgroundColor: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: newPromptTitle.trim() ? "pointer" : "not-allowed",
                opacity: newPromptTitle.trim() ? 1 : 0.5,
              }}
            >
              Save
            </button>
            <button
              onClick={() => { setShowSavePrompt(false); setNewPromptTitle(""); }}
              style={{
                padding: "8px 12px",
                backgroundColor: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            </div>
            <div style={{
              marginTop: "4px",
              fontSize: "11px",
              color: newPromptTitle.length > 180 ? "#dc2626" : "#94a3b8",
              textAlign: "right",
            }}>
              {newPromptTitle.length} / 200
            </div>
          </div>
        )}

        <div style={styles.inputArea}>
          {/* Transparency status bar */}
          {selectedTransparency && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                padding: "8px 12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #86efac",
              }}
            >
              <span style={{ fontSize: "12px", color: "#166534" }}>
                Last prompt used: {selectedTransparency.model} • {selectedTransparency.knowledgeContext.length.toLocaleString()} chars of context
              </span>
              <button
                onClick={() => setShowTransparency(true)}
                style={{
                  padding: "4px 10px",
                  backgroundColor: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                View Full Prompt
              </button>
            </div>
          )}
          <div style={{ position: "relative" }}>
            <div style={styles.inputWrapper}>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value.slice(0, 10000))}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedCount === 0
                    ? "Select at least one skill to start chatting..."
                    : "Ask a question about your knowledge base..."
                }
                disabled={isLoading || selectedCount === 0}
                style={{
                  ...styles.textarea,
                  opacity: selectedCount === 0 ? 0.6 : 1,
                }}
                maxLength={10000}
              />
            {inputValue.trim() && !showSavePrompt && (
              <button
                onClick={() => setShowSavePrompt(true)}
                style={{
                  padding: "12px",
                  backgroundColor: "#f1f5f9",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
                title="Save as prompt"
              >
                💾
              </button>
            )}
            <button
              onClick={() => {
                setSelectedTransparency(getPreviewPrompt());
                setShowPreviewPrompt(true);
              }}
              disabled={selectedCount === 0}
              style={{
                padding: "12px 16px",
                backgroundColor: "#f0fdf4",
                color: "#166534",
                border: "1px solid #86efac",
                borderRadius: "12px",
                fontWeight: 500,
                cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                opacity: selectedCount === 0 ? 0.5 : 1,
                fontSize: "13px",
              }}
              title="Preview the system prompt that will be sent"
            >
              Preview Prompt
            </button>
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading || selectedCount === 0}
              style={{
                ...styles.sendButton,
                opacity: !inputValue.trim() || isLoading || selectedCount === 0 ? 0.5 : 1,
                cursor: !inputValue.trim() || isLoading || selectedCount === 0 ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "4px",
              fontSize: "11px",
              color: inputValue.length > 9000 ? "#dc2626" : "#94a3b8",
            }}>
              {inputValue.length.toLocaleString()} / 10,000
            </div>
          </div>
        </div>
      </div>

      {/* Transparency Modal (for both preview and post-response) */}
      {(showTransparency || showPreviewPrompt) && selectedTransparency && (
        <TransparencyModal
          title={showPreviewPrompt ? "System Prompt Preview" : "Prompt Transparency"}
          subtitle={showPreviewPrompt
            ? "This is the system prompt that will be sent with your message"
            : "See exactly what was sent to the AI model"}
          onClose={() => { setShowTransparency(false); setShowPreviewPrompt(false); }}
          configs={[
            { label: "MODEL", value: selectedTransparency.model, color: "blue" },
            { label: "MAX TOKENS", value: selectedTransparency.maxTokens, color: "yellow" },
            { label: "TEMPERATURE", value: selectedTransparency.temperature, color: "green" },
          ]}
          systemPrompt={selectedTransparency.systemPrompt}
          userPrompt={selectedTransparency.knowledgeContext}
          userPromptLabel="Knowledge Context (included in system prompt)"
          userPromptNote={`Total knowledge context: ${selectedTransparency.knowledgeContext.length.toLocaleString()} characters`}
        />
      )}

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
