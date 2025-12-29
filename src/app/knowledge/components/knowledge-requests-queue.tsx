"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

interface KnowledgeRequest {
  id: string;
  title: string;
  description: string;
  suggestedUrls: string[];
  categories: string[];
  status: RequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
  requestedBy?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface KnowledgeRequestsQueueProps {
  canManage: boolean;
}

const statusConfig: Record<RequestStatus, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Approved", color: "bg-blue-100 text-blue-800" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
};

// Format relative time without date-fns
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function KnowledgeRequestsQueue({ canManage }: KnowledgeRequestsQueueProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch pending requests only
  const { data, isLoading, error } = useQuery({
    queryKey: ["knowledge-requests", "pending"],
    queryFn: async () => {
      const res = await fetch(`/api/knowledge-requests?status=PENDING`);
      if (!res.ok) throw new Error("Failed to fetch requests");
      const json = await res.json();
      return json.data as { requests: KnowledgeRequest[]; canManage: boolean };
    },
  });

  // Dismiss request mutation
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/knowledge-requests/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to dismiss request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-requests"] });
      setExpandedId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDismiss = (id: string) => {
    dismissMutation.mutate(id);
    toast.success("Request dismissed");
  };


  const handleBuildSkill = () => {
    router.push("/knowledge/add");
  };

  const requests = data?.requests || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load requests. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Knowledge Requests</h2>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Review and process knowledge requests from users"
              : "Your submitted knowledge requests"}
          </p>
        </div>
      </div>

      {/* Request list */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pending requests found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const isExpanded = expandedId === request.id;
            const status = statusConfig[request.status];


            return (
              <Card key={request.id} className={cn(isExpanded && "ring-2 ring-primary")}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn("text-xs", status.color)}>
                          {status.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(request.createdAt)}
                        </span>
                      </div>
                      <CardTitle className="text-base">{request.title}</CardTitle>
                      {request.requestedBy && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {request.requestedBy.name || request.requestedBy.email}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4 space-y-4">
                    {/* Description */}
                    <div>
                      <h4 className="text-sm font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {request.description}
                      </p>
                    </div>

                    {/* URLs */}
                    {request.suggestedUrls.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Suggested URLs ({request.suggestedUrls.length})</h4>
                        <div className="space-y-1">
                          {request.suggestedUrls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{url}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Categories */}
                    {request.categories.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Suggested Categories</h4>
                        <div className="flex flex-wrap gap-1">
                          {request.categories.map((cat) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Review note (if exists) */}
                    {request.reviewNote && (
                      <div className="bg-muted/50 rounded-md p-3">
                        <h4 className="text-sm font-medium mb-1">Review Note</h4>
                        <p className="text-sm text-muted-foreground">{request.reviewNote}</p>
                      </div>
                    )}

                    {/* Build Skill action */}
                    {canManage && request.status === "PENDING" && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleBuildSkill()}
                          className="gap-1.5"
                        >
                          <Sparkles className="h-4 w-4" />
                          Build Skill
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(request.id)}
                          disabled={dismissMutation.isPending}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
