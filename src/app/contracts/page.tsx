"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { InlineError } from "@/components/ui/status-display";
import { ContractReviewSummary } from "@/types/contractReview";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

const ratingConfig: Record<string, { className: string; label: string }> = {
  compliant: { className: "bg-green-100 text-green-800 hover:bg-green-100", label: "Compliant" },
  mostly_compliant: { className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100", label: "Mostly Compliant" },
  needs_review: { className: "bg-orange-100 text-orange-800 hover:bg-orange-100", label: "Needs Review" },
  high_risk: { className: "bg-red-100 text-red-800 hover:bg-red-100", label: "High Risk" },
};

const statusConfig: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  ANALYZING: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  ANALYZED: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  REVIEWED: "bg-green-100 text-green-700 hover:bg-green-100",
  ARCHIVED: "bg-gray-100 text-gray-500 hover:bg-gray-100",
};

export default function ContractLibraryPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch contracts
  const {
    data: contracts = [],
    isLoading: loading,
    error: queryError,
  } = useApiQuery<ContractReviewSummary[]>({
    queryKey: ["contracts"],
    url: "/api/contracts",
    responseKey: "contracts",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  const error = queryError?.message || null;

  // Delete mutation
  const deleteMutation = useApiMutation<void, string>({
    url: (id) => `/api/contracts/${id}`,
    method: "DELETE",
    invalidateKeys: [["contracts"]],
    onSuccess: () => {
      setDeleteConfirm(null);
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const filteredContracts = contracts.filter((c) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !c.name.toLowerCase().includes(searchLower) &&
        !c.customerName?.toLowerCase().includes(searchLower) &&
        !c.contractType?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (ratingFilter !== "all" && c.overallRating !== ratingFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <LoadingSpinner title="Loading contracts..." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            The Clause Checker{" "}
            <span className="font-normal text-base text-muted-foreground">
              Library
            </span>
          </h1>
          <p className="text-muted-foreground">
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""} reviewed
          </p>
        </div>
        <Button asChild>
          <Link href="/contracts">Upload New Contract</Link>
        </Button>
      </div>

      {error && <InlineError message={error} />}
      {deleteMutation.error && (
        <InlineError message={deleteMutation.error.message} />
      )}

      {contracts.length > 0 && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <Input
            type="text"
            placeholder="Search by name, customer, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="ANALYZING">Analyzing</SelectItem>
              <SelectItem value="ANALYZED">Analyzed</SelectItem>
              <SelectItem value="REVIEWED">Reviewed</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="compliant">Compliant</SelectItem>
              <SelectItem value="mostly_compliant">Mostly Compliant</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="high_risk">High Risk</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredContracts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {contracts.length === 0 ? (
            <>
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No contracts yet</h3>
              <p className="mb-5">
                Upload your first contract to start analyzing security clauses.
              </p>
              <Button asChild>
                <Link href="/contracts">Upload Contract</Link>
              </Button>
            </>
          ) : (
            <p>No contracts match your filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContracts.map((contract) => {
            const rating = ratingConfig[contract.overallRating || "needs_review"];
            const statusClassName = statusConfig[contract.status] || statusConfig.PENDING;

            return (
              <Card
                key={contract.id}
                className="p-5 cursor-pointer transition-all hover:border-primary hover:shadow-md"
                onClick={() => router.push(`/contracts/${contract.id}`)}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1.5">{contract.name}</h3>
                    <div className="text-sm text-muted-foreground mb-2.5">
                      {contract.customerName && <span>{contract.customerName} • </span>}
                      {contract.contractType && <span>{contract.contractType} • </span>}
                      <span>{new Date(contract.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {contract.overallRating && (
                        <Badge className={rating.className}>
                          {rating.label}
                        </Badge>
                      )}
                      <Badge className={statusClassName}>
                        {contract.status}
                      </Badge>
                      {contract.findingsCount !== undefined && contract.findingsCount > 0 && (
                        <Badge variant="secondary">
                          {contract.findingsCount} findings
                        </Badge>
                      )}
                      {contract.riskCount !== undefined && contract.riskCount > 0 && (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                          {contract.riskCount} risks
                        </Badge>
                      )}
                      {contract.gapCount !== undefined && contract.gapCount > 0 && (
                        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                          {contract.gapCount} gaps
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {deleteConfirm === contract.id ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(contract.id);
                          }}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(contract.id);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
