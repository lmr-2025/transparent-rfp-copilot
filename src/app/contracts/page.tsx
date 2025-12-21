"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ContractReviewSummary } from "@/types/contractReview";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import {
  ContractStatusFilter,
  ContractStatusSummaryCards,
  calculateContractFilterCounts,
  ContractStatusFilter as FilterType,
} from "./components/status-filter";

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

function getStatusLabel(filter: FilterType): string {
  const labels: Record<string, string> = {
    all: "All",
    PENDING: "Pending",
    ANALYZING: "Analyzing",
    ANALYZED: "Ready for Review",
    REVIEWED: "Reviewed",
    ARCHIVED: "Archived",
    has_flagged: "Has Flagged Findings",
  };
  return labels[filter] || filter;
}

function ContractsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [statusFilter, setStatusFilter] = useState<FilterType>(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam && ["all", "PENDING", "ANALYZED", "REVIEWED", "has_flagged"].includes(filterParam)) {
      return filterParam as FilterType;
    }
    return "all";
  });
  const [search, setSearch] = useState("");
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

  // Delete mutation
  const deleteMutation = useApiMutation<void, string>({
    url: (id) => `/api/contracts/${id}`,
    method: "DELETE",
    invalidateKeys: [["contracts"]],
    onSuccess: () => {
      setDeleteConfirm(null);
      toast.success("Contract deleted");
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Calculate filter counts
  const filterCounts = useMemo(() => calculateContractFilterCounts(contracts), [contracts]);

  // Filter contracts
  const filteredContracts = useMemo(() => {
    let filtered = contracts;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.customerName?.toLowerCase().includes(searchLower) ||
          c.contractType?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter === "has_flagged") {
      filtered = filtered.filter((c) => (c.flaggedCount || 0) > 0);
    } else if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Sort by most recent first
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [contracts, search, statusFilter]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contract Reviews</h1>
          <p className="text-muted-foreground mt-2">
            Upload contracts, analyze security clauses, and track review status.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/contracts/upload">
            <Plus className="h-4 w-4" />
            Upload Contract
          </Link>
        </Button>
      </div>

      {/* Error state */}
      {queryError && (
        <Card className="mb-4 border-destructive bg-destructive/10">
          <CardContent className="py-3 text-destructive">
            Failed to load contracts. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <InlineLoader size="lg" className="text-muted-foreground" />
          </CardContent>
        </Card>
      ) : contracts.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <h3 className="font-semibold text-foreground mb-2">No contracts yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Upload a PDF or DOCX contract to analyze security clauses against your knowledge base.
            </p>
            <Button asChild>
              <Link href="/contracts/upload">Upload Your First Contract</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status Summary Cards */}
          <div className="mb-8">
            <ContractStatusSummaryCards
              currentFilter={statusFilter}
              onFilterChange={setStatusFilter}
              counts={filterCounts}
            />
          </div>

          {/* Search and Filter */}
          <div className="flex justify-between items-center mb-4 gap-4">
            <div className="flex gap-3 items-center">
              <Input
                type="text"
                placeholder="Search contracts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <span className="text-sm text-muted-foreground">
                {filteredContracts.length} contract{filteredContracts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ContractStatusFilter
              currentFilter={statusFilter}
              onFilterChange={setStatusFilter}
              counts={filterCounts}
            />
          </div>

          {/* Section header */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            {statusFilter === "all"
              ? "All Contracts"
              : `${getStatusLabel(statusFilter)} Contracts`}
          </h2>

          {/* Contracts List */}
          {filteredContracts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No contracts match your filters.
              </CardContent>
            </Card>
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
                            <Badge className={rating.className}>{rating.label}</Badge>
                          )}
                          <Badge className={statusClassName}>{contract.status}</Badge>
                          {contract.findingsCount > 0 && (
                            <Badge variant="secondary">{contract.findingsCount} findings</Badge>
                          )}
                          {contract.riskCount > 0 && (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                              {contract.riskCount} risks
                            </Badge>
                          )}
                          {contract.gapCount > 0 && (
                            <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                              {contract.gapCount} gaps
                            </Badge>
                          )}
                          {(contract.flaggedCount || 0) > 0 && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                              {contract.flaggedCount} flagged
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
        </>
      )}
    </div>
  );
}

export default function ContractsLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto p-6">
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <InlineLoader size="lg" className="text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <ContractsListContent />
    </Suspense>
  );
}
