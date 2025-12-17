"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useProjects,
  useUpdateProject,
  getStatusLabel,
} from "@/hooks/use-project-data";
import { ProjectsTable } from "./components/projects-table";
import {
  StatusFilter,
  StatusSummaryCards,
  calculateFilterCounts,
} from "./components/status-filter";
import { BulkProject } from "@/types/bulkProject";

function ProjectsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // State
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam && ["all", "draft", "in_progress", "needs_review", "finalized", "has_flagged"].includes(filterParam)) {
      return filterParam as StatusFilter;
    }
    return "all";
  });
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // React Query
  const { data: projects = [], isLoading, error } = useProjects();
  const updateProjectMutation = useUpdateProject();


  // Calculate filter counts
  const filterCounts = useMemo(() => calculateFilterCounts(projects), [projects]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (statusFilter === "has_flagged") {
      filtered = projects.filter((p) => p.rows.some((r) => r.flaggedForReview));
    } else if (statusFilter !== "all") {
      filtered = projects.filter((p) => p.status === statusFilter);
    }

    // Sort by most recently modified first (FIFO for review queue)
    return [...filtered].sort((a, b) => {
      if (statusFilter === "needs_review") {
        const aTime = a.reviewRequestedAt ? new Date(a.reviewRequestedAt).getTime() : 0;
        const bTime = b.reviewRequestedAt ? new Date(b.reviewRequestedAt).getTime() : 0;
        return aTime - bTime;
      }
      return new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime();
    });
  }, [projects, statusFilter]);

  // Handlers
  const handleApprove = async (project: BulkProject) => {
    // Use session user's name or email for attribution
    const reviewerName = session?.user?.name || session?.user?.email || "Unknown User";

    setApprovingId(project.id);
    try {
      await updateProjectMutation.mutateAsync({
        ...project,
        status: "finalized",
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerName,
      });
      toast.success("Project finalized");
    } catch {
      toast.error("Failed to approve project");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">RFP Projects</h1>
          <p className="text-muted-foreground mt-2">
            Upload questionnaires, generate AI responses, and track progress through review.
          </p>
        </div>
        <Button onClick={() => router.push("/projects/upload")} className="gap-2">
          <Plus className="h-4 w-4" />
          Upload New
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card className="mb-4 border-destructive bg-destructive/10">
          <CardContent className="py-3 text-destructive">
            Failed to load projects. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <h3 className="font-semibold text-foreground mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Upload a CSV or Excel questionnaire to create your first project. AI will generate
              responses that you review and approve.
            </p>
            <Button onClick={() => router.push("/projects/upload")}>
              Upload Your First Questionnaire
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status Summary Cards */}
          <div className="mb-8">
            <StatusSummaryCards
              currentFilter={statusFilter}
              onFilterChange={setStatusFilter}
              counts={filterCounts}
            />
          </div>

          {/* All Projects Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {statusFilter === "all"
                  ? "All Projects"
                  : statusFilter === "has_flagged"
                  ? "Projects with Flagged Questions"
                  : `${getStatusLabel(statusFilter)} Projects`}
              </h2>
              <StatusFilter
                currentFilter={statusFilter}
                onFilterChange={setStatusFilter}
                counts={filterCounts}
              />
            </div>

            <ProjectsTable
              projects={filteredProjects}
              onApprove={handleApprove}
              approvingId={approvingId}
            />

            {/* Flagged Questions Detail Section */}
            {statusFilter === "has_flagged" && filteredProjects.length > 0 && (
              <Card className="mt-4">
                <CardContent className="py-4">
                  <h3 className="font-semibold mb-4">Flagged Question Details</h3>
                  {filteredProjects.map((project) => {
                    const flaggedRows = project.rows.filter((r) => r.flaggedForReview);
                    return (
                      <div
                        key={project.id}
                        className="mb-4 pb-4 border-b border-border last:border-0 last:mb-0 last:pb-0"
                      >
                        <div className="font-medium mb-2">
                          {project.customerName || "No customer"} — {project.name}
                        </div>
                        {flaggedRows.map((row) => (
                          <div key={row.id} className="text-sm text-muted-foreground ml-4 mb-1">
                            <span className="font-medium">Row {row.rowNumber}:</span>{" "}
                            {row.question.slice(0, 80)}
                            {row.question.length > 80 ? "..." : ""}
                            {row.flagNote && (
                              <span className="text-amber-700 italic"> — &quot;{row.flagNote}&quot;</span>
                            )}
                            {row.flaggedBy && (
                              <span className="text-muted-foreground/70"> (by {row.flaggedBy})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProjectsListPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto p-6">
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <ProjectsListContent />
    </Suspense>
  );
}
