"use client";

import { RefObject } from "react";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  Globe,
  Users,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  UserPlus,
  Lock,
  CheckSquare,
  Square,
} from "lucide-react";
import { Skill, SkillOwner } from "@/types/skill";
import UserSelector, { SelectableUser } from "@/components/UserSelector";
import { LibraryItem, TabType, OwnerEditState } from "../types";
import { styles } from "../styles";

interface LibraryItemCardProps {
  item: LibraryItem;
  isExpanded: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  highlightRef?: RefObject<HTMLDivElement | null>;
  ownerEdit: OwnerEditState;
  // Handlers
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (type: TabType, id: string, title: string) => void;
  onStartSelectingOwner: (skillId: string) => void;
  onCancelSelectingOwner: () => void;
  onSelectOwner: (skillId: string, user: SelectableUser) => void;
  onRemoveOwner: (skillId: string, owner: SkillOwner) => void;
  canEditSkill: (skill: Skill) => boolean;
}

export function getTypeIcon(type: TabType) {
  switch (type) {
    case "skills": return <BookOpen size={16} />;
    case "documents": return <FileText size={16} />;
    case "urls": return <Globe size={16} />;
    case "customers": return <Users size={16} />;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryItemCard({
  item,
  isExpanded,
  isHighlighted,
  isSelected,
  highlightRef,
  ownerEdit,
  onToggleExpand,
  onToggleSelect,
  onDelete,
  onStartSelectingOwner,
  onCancelSelectingOwner,
  onSelectOwner,
  onRemoveOwner,
  canEditSkill,
}: LibraryItemCardProps) {
  return (
    <div
      ref={isHighlighted ? highlightRef : undefined}
      style={{
        ...styles.card,
        ...(isHighlighted ? {
          borderColor: "#0ea5e9",
          boxShadow: "0 0 0 2px rgba(14, 165, 233, 0.2)",
          transition: "border-color 0.3s, box-shadow 0.3s",
        } : {}),
        ...(isSelected ? {
          borderColor: "#0ea5e9",
          backgroundColor: "#f0f9ff",
        } : {}),
      }}
    >
      <div style={styles.cardHeader}>
        {/* Checkbox for skills */}
        {item.type === "skills" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(item.id);
            }}
            style={{
              padding: "4px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              marginRight: "8px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isSelected ? (
              <CheckSquare size={20} style={{ color: "#0ea5e9" }} />
            ) : (
              <Square size={20} style={{ color: "#cbd5e1" }} />
            )}
          </button>
        )}

        <div style={{ flex: 1 }}>
          <div style={styles.cardTitle}>
            {getTypeIcon(item.type)}
            {item.type === "skills" ? (
              <Link
                href={`/knowledge?skill=${item.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {item.title}
              </Link>
            ) : item.type === "customers" ? (
              <Link
                href={`/customers/${item.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </div>

          {/* Skill-specific meta: owners and source URLs */}
          {item.type === "skills" && item.skillData && (
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {item.skillData.owners && item.skillData.owners.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: "#f59e0b" }}>👤</span>
                  {item.skillData.owners.map(o => o.name).join(", ")}
                </span>
              )}
              {item.skillData.sourceUrls && item.skillData.sourceUrls.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Globe size={12} style={{ color: "#0ea5e9" }} />
                  {item.skillData.sourceUrls.length} source{item.skillData.sourceUrls.length > 1 ? "s" : ""}
                </span>
              )}
              {item.skillData.lastRefreshedAt && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  Refreshed {new Date(item.skillData.lastRefreshedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

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

          {/* Customer-specific info */}
          {item.type === "customers" && item.customerData && (
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {item.customerData.industry && (
                <span>{item.customerData.industry}</span>
              )}
              {item.customerData.website && (
                <a
                  href={item.customerData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0ea5e9", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.customerData.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Expand button for skills */}
          {item.type === "skills" && (
            <button
              onClick={() => onToggleExpand(item.id)}
              style={styles.expandButton}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {isExpanded ? "Less" : "More"}
            </button>
          )}

          {/* Delete button - for skills, only show if user can edit */}
          {(item.type !== "skills" || (item.skillData && canEditSkill(item.skillData))) ? (
            <button
              onClick={() => onDelete(item.type, item.id, item.title)}
              style={styles.deleteButton}
              title="Delete"
              onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#94a3b8"}
            >
              <Trash2 size={16} />
            </button>
          ) : item.type === "skills" && item.skillData?.owners && item.skillData.owners.length > 0 && (
            <div
              title="Only owners can edit or delete this skill"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "#94a3b8",
                fontSize: "0.8rem",
              }}
            >
              <Lock size={14} />
            </div>
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
          {item.skillData.sourceUrls && item.skillData.sourceUrls.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <strong>Source URLs:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                {item.skillData.sourceUrls.map((srcUrl, i) => (
                  <li key={i}>
                    <a
                      href={srcUrl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0ea5e9", textDecoration: "none" }}
                    >
                      {srcUrl.url}
                    </a>
                    <span style={{ color: "#94a3b8", fontSize: "0.85rem", marginLeft: "8px" }}>
                      (added {new Date(srcUrl.addedAt).toLocaleDateString()})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Owners section with management */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong>Owners:</strong>
              {ownerEdit.skillId !== item.id && canEditSkill(item.skillData) && (
                <button
                  onClick={() => onStartSelectingOwner(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 10px",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: "6px",
                    color: "#166534",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  <UserPlus size={14} />
                  Assign Owner
                </button>
              )}
            </div>

            {/* User selector for adding owner */}
            {ownerEdit.skillId === item.id && ownerEdit.isSelecting && (
              <div style={{ marginBottom: "12px" }}>
                <UserSelector
                  onSelect={(user) => onSelectOwner(item.id, user)}
                  onCancel={onCancelSelectingOwner}
                  excludeUserIds={(item.skillData.owners || [])
                    .filter(o => o.userId)
                    .map(o => o.userId as string)}
                  placeholder="Search team members..."
                  disabled={ownerEdit.isSaving}
                />
                {ownerEdit.isSaving && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "8px",
                    color: "#64748b",
                    fontSize: "0.85rem",
                  }}>
                    <Loader2 size={14} className="animate-spin" />
                    Assigning owner...
                  </div>
                )}
              </div>
            )}

            {/* Owner list */}
            {item.skillData.owners && item.skillData.owners.length > 0 ? (
              <ul style={{ margin: "0", paddingLeft: "0", listStyle: "none" }}>
                {item.skillData.owners.map((owner, i) => (
                  <li
                    key={owner.userId || i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      backgroundColor: i % 2 === 0 ? "#f9fafb" : "#fff",
                      borderRadius: "4px",
                      marginBottom: "2px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {owner.image ? (
                        <img
                          src={owner.image}
                          alt={owner.name}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: "#e0f2fe",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#0369a1",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                        }}>
                          {owner.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{owner.name}</div>
                        {owner.email && (
                          <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{owner.email}</div>
                        )}
                      </div>
                    </div>
                    {canEditSkill(item.skillData!) && (
                      <button
                        onClick={() => onRemoveOwner(item.id, owner)}
                        style={{
                          padding: "4px",
                          backgroundColor: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                          borderRadius: "4px",
                        }}
                        title={`Remove ${owner.name}`}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#94a3b8"}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0, fontStyle: "italic" }}>
                No owners assigned yet
              </p>
            )}
          </div>
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
}
