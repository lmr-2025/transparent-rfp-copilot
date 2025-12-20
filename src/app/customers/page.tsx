"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAllProfiles,
  updateProfile,
  deleteProfile,
} from "@/lib/customerProfileApi";
import { CustomerProfile } from "@/types/customerProfile";
import { InlineError } from "@/components/ui/status-display";
import CustomerDocuments from "./components/CustomerDocuments";
import { SyncStatusBadge } from "@/components/ui/sync-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export default function CustomerProfileLibraryPage() {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<CustomerProfile | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profiles
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await fetchAllProfiles();
      setProfiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  // Filter profiles
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.industry?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && p.isActive) ||
      (statusFilter === "inactive" && !p.isActive);
    return matchesSearch && matchesStatus;
  });

  // Toggle expand
  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingProfile(null);
    } else {
      setExpandedId(id);
      setEditingProfile(null);
    }
    setConfirmingDeleteId(null);
  };

  // Start editing
  const startEdit = (profile: CustomerProfile) => {
    setEditingProfile({ ...profile });
  };

  // Save edit
  const saveEdit = async () => {
    if (!editingProfile) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(editingProfile.id, {
        name: editingProfile.name,
        industry: editingProfile.industry,
        website: editingProfile.website,
        content: editingProfile.content,
        considerations: editingProfile.considerations,
        // Keep legacy fields in sync for backwards compatibility
        overview: editingProfile.content || editingProfile.overview,
        isActive: editingProfile.isActive,
      });
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setEditingProfile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // Delete profile
  const handleDelete = async (id: string) => {
    try {
      await deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setExpandedId(null);
      setConfirmingDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete profile");
    }
  };

  // Toggle active status
  const toggleActive = async (profile: CustomerProfile) => {
    try {
      const updated = await updateProfile(profile.id, {
        isActive: !profile.isActive,
      });
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
    }
  };

  // Update editing field
  const updateEditField = (field: keyof CustomerProfile, value: unknown) => {
    if (!editingProfile) return;
    setEditingProfile({ ...editingProfile, [field]: value });
  };

  // Consideration helpers
  const addConsideration = () => {
    if (!editingProfile) return;
    updateEditField("considerations", [...(editingProfile.considerations || []), ""]);
  };

  const updateConsideration = (idx: number, value: string) => {
    if (!editingProfile) return;
    const considerations = [...(editingProfile.considerations || [])];
    considerations[idx] = value;
    updateEditField("considerations", considerations);
  };

  const removeConsideration = (idx: number) => {
    if (!editingProfile) return;
    updateEditField(
      "considerations",
      (editingProfile.considerations || []).filter((_, i) => i !== idx)
    );
  };

  // Helper to get display content (prefer new content field, fall back to legacy)
  const getDisplayContent = (profile: CustomerProfile): string => {
    if (profile.content) return profile.content;
    // Build from legacy fields if content not set
    const parts = [];
    if (profile.overview) parts.push(`## Overview\n${profile.overview}`);
    if (profile.products) parts.push(`## Products & Services\n${profile.products}`);
    if (profile.challenges) parts.push(`## Challenges & Needs\n${profile.challenges}`);
    if (profile.keyFacts?.length > 0) {
      parts.push(`## Key Facts\n${profile.keyFacts.map(f => `- **${f.label}:** ${f.value}`).join("\n")}`);
    }
    return parts.join("\n\n");
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">
        The Rolodex{" "}
        <span className="font-normal text-muted-foreground">(Library)</span>
      </h1>
      <p className="text-muted-foreground mb-6">
        Manage your customer profiles.{" "}
        <Link href="/customers" className="text-primary hover:underline">
          Build New Profile →
        </Link>
      </p>

      {error && (
        <div className="mb-4">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 mb-5 items-center">
        <Input
          className="max-w-xs"
          placeholder="Search by name or industry..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Profiles</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredProfiles.length} profile{filteredProfiles.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Profiles List */}
      {filteredProfiles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">No profiles found</p>
          <p>
            {profiles.length === 0 ? (
              <>
                Get started by{" "}
                <Link href="/customers" className="text-primary hover:underline">
                  building your first customer profile
                </Link>
                .
              </>
            ) : (
              "Try adjusting your search or filter."
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProfiles.map((profile) => {
            const isExpanded = expandedId === profile.id;
            const isEditing = editingProfile?.id === profile.id;

            return (
              <Card
                key={profile.id}
                className={cn(
                  "p-4 cursor-pointer transition-colors",
                  isExpanded && "border-primary"
                )}
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(profile.id)}
                  className="flex justify-between items-start"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{profile.name}</h3>
                      <Badge
                        variant={profile.isActive ? "default" : "secondary"}
                        className={cn(
                          profile.isActive
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {profile.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <SyncStatusBadge
                        status={profile.syncStatus ?? null}
                        lastSyncedAt={profile.lastSyncedAt}
                        showLabel={false}
                      />
                    </div>
                    <div className="mt-1.5 flex gap-2 items-center">
                      {profile.industry && (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          {profile.industry}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <div>Updated {new Date(profile.updatedAt).toLocaleDateString()}</div>
                    <div className="mt-0.5">
                      {profile.sourceUrls.length} source{profile.sourceUrls.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div
                    className="mt-4 border-t pt-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            Company Name
                          </label>
                          <Input
                            value={editingProfile.name}
                            onChange={(e) => updateEditField("name", e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Industry
                            </label>
                            <Input
                              value={editingProfile.industry || ""}
                              onChange={(e) => updateEditField("industry", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Website
                            </label>
                            <Input
                              value={editingProfile.website || ""}
                              onChange={(e) => updateEditField("website", e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            Profile Content
                          </label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Use markdown formatting. Include sections like Overview, Products & Services, Challenges & Needs, Key Facts.
                          </p>
                          <Textarea
                            className="min-h-[300px] font-mono text-sm"
                            value={editingProfile.content || getDisplayContent(editingProfile)}
                            onChange={(e) => updateEditField("content", e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            Considerations
                          </label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Special notes or caveats to keep in mind when working with this customer.
                          </p>
                          <div className="space-y-2">
                            {(editingProfile.considerations || []).map((consideration, idx) => (
                              <div key={idx} className="flex gap-2">
                                <Input
                                  className="flex-1"
                                  value={consideration}
                                  onChange={(e) => updateConsideration(idx, e.target.value)}
                                  placeholder="Enter a consideration..."
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeConsideration(idx)}
                                >
                                  ✕
                                </Button>
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={addConsideration}
                          >
                            + Add Consideration
                          </Button>
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="outline"
                            onClick={() => setEditingProfile(null)}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                          <Button onClick={saveEdit} disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        {/* Salesforce Static Fields (read-only) */}
                        {profile.salesforceId && (
                          <div className="mb-4 p-3 bg-sky-50 rounded-md border border-sky-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-sky-600 text-white hover:bg-sky-600">
                                Salesforce
                              </Badge>
                              <span className="text-xs text-sky-700">
                                Linked to Salesforce Account
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              {profile.region && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Region:</span>{" "}
                                  <span className="text-sky-900">{profile.region}</span>
                                </div>
                              )}
                              {profile.tier && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Tier:</span>{" "}
                                  <span className="text-sky-900">{profile.tier}</span>
                                </div>
                              )}
                              {profile.accountType && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Type:</span>{" "}
                                  <span className="text-sky-900">{profile.accountType}</span>
                                </div>
                              )}
                              {profile.billingLocation && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Location:</span>{" "}
                                  <span className="text-sky-900">{profile.billingLocation}</span>
                                </div>
                              )}
                              {profile.employeeCount && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Employees:</span>{" "}
                                  <span className="text-sky-900">{profile.employeeCount.toLocaleString()}</span>
                                </div>
                              )}
                              {profile.annualRevenue && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Revenue:</span>{" "}
                                  <span className="text-sky-900">${(profile.annualRevenue / 1000000).toFixed(1)}M</span>
                                </div>
                              )}
                            </div>
                            {profile.lastSalesforceSync && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                Last synced: {new Date(profile.lastSalesforceSync).toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mb-3">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {getDisplayContent(profile)}
                          </div>
                        </div>

                        {profile.considerations && profile.considerations.length > 0 && (
                          <div className="mb-3 mt-4 p-3 bg-amber-50 rounded-md border border-amber-200">
                            <strong className="text-amber-800 text-sm">Considerations</strong>
                            <ul className="mt-2 ml-5 list-disc">
                              {profile.considerations.map((c, idx) => (
                                <li key={idx} className="text-sm text-amber-900 mb-1">
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {profile.sourceUrls.length > 0 && (
                          <div className="mb-3">
                            <strong className="text-sm text-foreground">Sources</strong>
                            <div className="mt-1">
                              {profile.sourceUrls.map((source, idx) => (
                                <div key={idx} className="text-sm">
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {source.url}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Customer Documents */}
                        <CustomerDocuments
                          customerId={profile.id}
                          customerName={profile.name}
                        />

                        {/* Actions */}
                        <div className="mt-4 flex gap-2 flex-wrap">
                          <Button onClick={() => startEdit(profile)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => toggleActive(profile)}
                          >
                            {profile.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          {confirmingDeleteId === profile.id ? (
                            <>
                              <span className="text-sm text-destructive self-center">
                                Delete permanently?
                              </span>
                              <Button
                                variant="destructive"
                                onClick={() => handleDelete(profile.id)}
                              >
                                Yes, Delete
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setConfirmingDeleteId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="destructive"
                              onClick={() => setConfirmingDeleteId(profile.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
