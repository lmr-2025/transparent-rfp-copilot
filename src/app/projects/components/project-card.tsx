"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BulkProject } from "@/types/bulkProject";
import { getProjectStats, getStatusColor, getStatusLabel } from "@/hooks/use-project-data";

interface ProjectCardProps {
  project: BulkProject;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const stats = getProjectStats(project);
  const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const statusColors = getStatusColor(project.status);

  const borderColor = {
    approved: "border-l-green-500",
    needs_review: "border-l-amber-500",
    in_progress: "border-l-blue-500",
    draft: "border-l-slate-400",
  }[project.status];

  return (
    <Card
      className={cn(
        "cursor-pointer border-l-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        borderColor
      )}
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
            {project.customerProfiles && project.customerProfiles.length > 0 ? (
              <div className="flex gap-1 flex-wrap mt-1">
                {project.customerProfiles.slice(0, 2).map((cp) => (
                  <span
                    key={cp.id}
                    className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded"
                  >
                    {cp.name}
                  </span>
                ))}
              </div>
            ) : project.customerName ? (
              <p className="text-sm text-muted-foreground mt-0.5">{project.customerName}</p>
            ) : null}
          </div>
          <span
            className={cn(
              "text-xs font-medium px-2 py-1 rounded flex-shrink-0",
              statusColors.bg,
              statusColors.text
            )}
          >
            {getStatusLabel(project.status)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>
              {stats.completed} of {stats.total} answered
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                progressPercent === 100 ? "bg-green-500" : "bg-blue-500"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Modified {new Date(project.lastModifiedAt).toLocaleDateString()}</span>
          {stats.flagged > 0 && (
            <span className="text-amber-600 font-semibold">{stats.flagged} flagged</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
