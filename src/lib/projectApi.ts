import { BulkProject, BulkRow } from "@/types/bulkProject";
import { createApiClient } from "./apiClient";

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

type ProjectPayload = ReturnType<typeof transformProjectToDb>;

const projectClient = createApiClient<DbProject, ProjectPayload, ProjectPayload>({
  baseUrl: "/api/projects",
  singularKey: "project",
  pluralKey: "projects",
});

export async function fetchAllProjects(): Promise<BulkProject[]> {
  const projects = await projectClient.fetchAll({ includeRows: "true" });
  return projects.map(transformProjectFromDb);
}

export async function fetchProject(id: string): Promise<BulkProject | null> {
  const project = await projectClient.fetch(id);
  return project ? transformProjectFromDb(project) : null;
}

export async function createProject(project: BulkProject): Promise<BulkProject> {
  const payload = transformProjectToDb(project);
  const created = await projectClient.create(payload);
  return transformProjectFromDb(created);
}

export async function updateProject(project: BulkProject): Promise<BulkProject> {
  const payload = transformProjectToDb(project);
  const updated = await projectClient.update(project.id, payload);
  return transformProjectFromDb(updated);
}

export async function deleteProject(id: string): Promise<void> {
  await projectClient.delete(id);
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
    status: dbProject.status.toLowerCase() as "draft" | "in_progress" | "needs_review" | "finalized",
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
