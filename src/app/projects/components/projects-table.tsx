"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BulkProject } from "@/types/bulkProject";
import { getProjectStats, getStatusColor, getStatusLabel } from "@/hooks/use-project-data";

interface ProjectsTableProps {
  projects: BulkProject[];
  onApprove: (project: BulkProject) => void;
  approvingId: string | null;
}

export function ProjectsTable({
  projects,
  onApprove,
  approvingId,
}: ProjectsTableProps) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No projects found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Project</th>
              <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Customer</th>
              <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Owner</th>
              <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Status</th>
              <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Progress</th>
              <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Modified</th>
              <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const stats = getProjectStats(project);
              const statusColors = getStatusColor(project.status);
              const isApproving = approvingId === project.id;

              return (
                <tr
                  key={project.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <td className="p-3">
                    <div className="font-medium text-foreground">{project.name}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-sm text-foreground">
                      {project.customerProfiles && project.customerProfiles.length > 0
                        ? project.customerProfiles.map((cp) => cp.name).join(", ")
                        : project.customerName || "—"}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-sm text-foreground">
                      {project.ownerName || "—"}
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-1 rounded",
                        statusColors.bg,
                        statusColors.text
                      )}
                    >
                      {getStatusLabel(project.status)}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="text-sm">
                      {stats.completed}/{stats.total}
                    </div>
                    {stats.flagged > 0 && (
                      <div className="text-amber-600 text-sm font-semibold">
                        {stats.flagged} flagged
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="text-sm text-muted-foreground">
                      {new Date(project.lastModifiedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    {project.status === "needs_review" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => onApprove(project)}
                        disabled={isApproving}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isApproving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Approve"
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
