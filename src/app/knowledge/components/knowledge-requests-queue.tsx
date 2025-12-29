"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle2,
  XCircle,
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
import { Textarea } from "@/components/ui/textarea";
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

const statusConfig: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-800", icon: <Clock className="h-3 w-3" /> },
  APPROVED: { label: "Approved", color: "bg-blue-100 text-blue-800", icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: <Sparkles className="h-3 w-3" /> },
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
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "ALL">("PENDING");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const queryClient = useQueryClient();

  // Fetch requests
  const { data, isLoading, error } = useQuery({
    queryKey: ["knowledge-requests", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      const res = await fetch(`/api/knowledge-requests?${params}`);
      if (!res.ok) throw new Error("Failed to fetch requests");
      const json = await res.json();
      return json.data as { requests: KnowledgeRequest[]; canManage: boolean };
    },
  });

  // Update request mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: RequestStatus; note?: string }) => {
      const res = await fetch(`/api/knowledge-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: note }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-requests"] });
      setExpandedId(null);
      setReviewNote("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleApprove = (id: string) => {
    updateMutation.mutate({ id, status: "APPROVED", note: reviewNote || undefined });
    toast.success("Request approved");
  };

  const handleReject = (id: string) => {
    if (!reviewNote.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    updateMutation.mutate({ id, status: "REJECTED", note: reviewNote });
    toast.success("Request rejected");
  };

  const handleBuildSkill = (request: KnowledgeRequest) => {
    // Store the request data and redirect to skill builder
    const urls = request.suggestedUrls;
    if (urls.length > 0) {
      sessionStorage.setItem("pendingKnowledgeUrls", JSON.stringify(urls));
      sessionStorage.setItem("pendingKnowledgeRequestId", request.id);
      window.location.href = "/knowledge/add";
    } else {
      toast.error("No URLs to process");
    }
  };

  const requests = data?.requests || [];
  const pendingCount = requests.filter(r => r.status === "PENDING").length;

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
        <div className="flex gap-2">
          {(["ALL", "PENDING", "APPROVED", "REJECTED", "COMPLETED"] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="text-xs"
            >
              {status === "ALL" ? "All" : statusConfig[status].label}
              {status === "PENDING" && pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Request list */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No {statusFilter !== "ALL" ? statusFilter.toLowerCase() : ""} requests found.
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
                          {status.icon}
                          <span className="ml-1">{status.label}</span>
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

                    {/* Actions for pending requests */}
                    {canManage && request.status === "PENDING" && (
                      <div className="space-y-3 pt-2 border-t">
                        <Textarea
                          placeholder="Add a note (required for rejection)..."
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleBuildSkill(request)}
                            disabled={request.suggestedUrls.length === 0}
                            className="gap-1.5"
                          >
                            <Sparkles className="h-4 w-4" />
                            Build Skill
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            disabled={updateMutation.isPending}
                            className="gap-1.5"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(request.id)}
                            disabled={updateMutation.isPending}
                            className="gap-1.5 text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Actions for approved requests */}
                    {canManage && request.status === "APPROVED" && (
                      <div className="pt-2 border-t">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleBuildSkill(request)}
                          disabled={request.suggestedUrls.length === 0}
                          className="gap-1.5"
                        >
                          <Sparkles className="h-4 w-4" />
                          Build Skill from URLs
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
