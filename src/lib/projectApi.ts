import { BulkProject, BulkRow } from "@/types/bulkProject";

/**
 * API client for project CRUD operations
 * These functions replace the localStorage-based storage with API calls
 */

// Type for database row format
interface DbRow {
  id: string;
  rowNumber: number;
  question: string;
  response: string;
  status: string;
  error?: string;
  conversationHistory?: unknown;
  confidence?: string;
  sources?: string;
  reasoning?: string;
  inference?: string;
  remarks?: string;
  usedSkills?: unknown;
  showRecommendation?: boolean;
  // Review flagging
  flaggedForReview?: boolean;
  flaggedAt?: string;
  flaggedBy?: string;
  flagNote?: string;
}

// Type for database project format
interface DbProject {
  id: string;
  name: string;
  sheetName: string;
  columns: string[];
  createdAt: string;
  lastModifiedAt: string;
  ownerName?: string;
  customerName?: string;
  status: string;
  notes?: string;
  reviewRequestedAt?: string;
  reviewRequestedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rows: DbRow[];
}

export async function fetchAllProjects(): Promise<BulkProject[]> {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  const json = await response.json();
  // Handle both old format ({ projects: [...] }) and new format ({ data: { projects: [...] } })
  const projects = json.data?.projects ?? json.projects ?? [];

  // Transform database format to frontend format
  return projects.map(transformProjectFromDb);
}

export async function fetchProject(id: string): Promise<BulkProject | null> {
  const response = await fetch(`/api/projects/${id}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Failed to fetch project");
  }
  const json = await response.json();
  // Handle both old format ({ project: {...} }) and new format ({ data: { project: {...} } })
  const project = json.data?.project ?? json.project;
  return transformProjectFromDb(project);
}

export async function createProject(project: BulkProject): Promise<BulkProject> {
  const payload = transformProjectToDb(project);
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to create project");
  }
  const json = await response.json();
  // Handle both old format ({ project: {...} }) and new format ({ data: { project: {...} } })
  const created = json.data?.project ?? json.project;
  return transformProjectFromDb(created);
}

export async function updateProject(project: BulkProject): Promise<BulkProject> {
  const payload = transformProjectToDb(project);
  const response = await fetch(`/api/projects/${project.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to update project");
  }
  const json = await response.json();
  // Handle both old format ({ project: {...} }) and new format ({ data: { project: {...} } })
  const updated = json.data?.project ?? json.project;
  return transformProjectFromDb(updated);
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete project");
  }
}

/**
 * Transform database project format to frontend BulkProject type
 */
function transformProjectFromDb(dbProject: DbProject): BulkProject {
  return {
    id: dbProject.id,
    name: dbProject.name,
    sheetName: dbProject.sheetName,
    columns: dbProject.columns,
    createdAt: dbProject.createdAt,
    lastModifiedAt: dbProject.lastModifiedAt,
    ownerName: dbProject.ownerName,
    customerName: dbProject.customerName,
    status: dbProject.status.toLowerCase() as "draft" | "in_progress" | "needs_review" | "approved",
    notes: dbProject.notes,
    reviewRequestedAt: dbProject.reviewRequestedAt,
    reviewRequestedBy: dbProject.reviewRequestedBy,
    reviewedAt: dbProject.reviewedAt,
    reviewedBy: dbProject.reviewedBy,
    rows: dbProject.rows.map((row: DbRow): BulkRow => ({
      id: row.id,
      rowNumber: row.rowNumber,
      question: row.question,
      response: row.response,
      status: row.status.toLowerCase() as "pending" | "completed" | "error",
      error: row.error,
      conversationHistory: row.conversationHistory as { role: string; content: string }[] | undefined,
      confidence: row.confidence,
      sources: row.sources,
      reasoning: row.reasoning,
      inference: row.inference,
      remarks: row.remarks,
      usedSkills: row.usedSkills as BulkRow["usedSkills"],
      showRecommendation: row.showRecommendation,
      // Review flagging
      flaggedForReview: row.flaggedForReview,
      flaggedAt: row.flaggedAt,
      flaggedBy: row.flaggedBy,
      flagNote: row.flagNote,
    })),
  };
}

/**
 * Transform frontend BulkProject type to database format
 */
function transformProjectToDb(project: BulkProject) {
  return {
    name: project.name,
    sheetName: project.sheetName,
    columns: project.columns,
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    customerName: project.customerName,
    notes: project.notes,
    status: project.status,
    // Review workflow fields
    reviewRequestedAt: project.reviewRequestedAt,
    reviewRequestedBy: project.reviewRequestedBy,
    reviewedAt: project.reviewedAt,
    reviewedBy: project.reviewedBy,
    rows: project.rows.map((row) => ({
      rowNumber: row.rowNumber,
      question: row.question,
      response: row.response,
      status: row.status,
      error: row.error,
      conversationHistory: row.conversationHistory,
      confidence: row.confidence,
      sources: row.sources,
      reasoning: row.reasoning,
      inference: row.inference,
      remarks: row.remarks,
      usedSkills: row.usedSkills,
      showRecommendation: row.showRecommendation,
      // Review flagging
      flaggedForReview: row.flaggedForReview,
      flaggedAt: row.flaggedAt,
      flaggedBy: row.flaggedBy,
      flagNote: row.flagNote,
    })),
  };
}
