import { BulkProject } from "@/types/bulkProject";

const STORAGE_KEY = "grc-minion-bulk-project";
const PROJECTS_STORAGE_KEY = "grc-minion-bulk-projects";

// ===== NEW: Multi-project storage =====

export function loadAllProjects(): BulkProject[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    // Try new multi-project storage first
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as BulkProject[];
    }

    // Migration: Check for old single-project storage
    const oldRaw = window.localStorage.getItem(STORAGE_KEY);
    if (oldRaw) {
      const oldProject = JSON.parse(oldRaw) as BulkProject;
      // Migrate old project: add missing fields with defaults
      const migratedProject: BulkProject = {
        ...oldProject,
        lastModifiedAt: oldProject.createdAt,
        status: "in_progress" as const,
        ownerName: undefined,
        customerName: undefined,
        notes: undefined,
      };
      // Save to new storage and clean up old
      const projects = [migratedProject];
      saveAllProjects(projects);
      window.localStorage.removeItem(STORAGE_KEY);
      return projects;
    }

    return [];
  } catch {
    return [];
  }
}

export function loadProject(id: string): BulkProject | null {
  const projects = loadAllProjects();
  return projects.find((p) => p.id === id) ?? null;
}

export function saveProject(project: BulkProject) {
  const projects = loadAllProjects();
  const index = projects.findIndex((p) => p.id === project.id);

  // Update lastModifiedAt
  const updatedProject = {
    ...project,
    lastModifiedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    // Update existing project
    projects[index] = updatedProject;
  } else {
    // Add new project
    projects.push(updatedProject);
  }

  saveAllProjects(projects);
}

export function deleteProject(id: string) {
  const projects = loadAllProjects();
  const filtered = projects.filter((p) => p.id !== id);
  saveAllProjects(filtered);
}

function saveAllProjects(projects: BulkProject[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // ignore
  }
}

// ===== OLD: Legacy single-project storage (for backward compatibility) =====

export function loadBulkProject(): BulkProject | null {
  // Try new storage first, return most recently modified project
  const projects = loadAllProjects();
  if (projects.length > 0) {
    return projects.sort((a, b) =>
      new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()
    )[0];
  }
  return null;
}

export function saveBulkProject(project: BulkProject | null) {
  if (!project) {
    // Don't implement delete here - use deleteProject instead
    return;
  }
  saveProject(project);
}
