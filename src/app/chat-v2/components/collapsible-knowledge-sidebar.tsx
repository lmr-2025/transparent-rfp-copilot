"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BookOpen,
  FileText,
  Globe,
  ChevronDown,
  ChevronRight,
  PanelRightClose,
  PanelRight,
  Phone,
  FileCheck,
  Database,
  FileDown,
  Link2,
  Loader2,
  StickyNote,
  Mail,
  Calendar,
  BarChart3,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSelectionStore } from "@/stores/selection-store";
import { KnowledgeSourceList } from "@/app/chat/components/knowledge-source-list";
import { TemplateSelector } from "./template-selector";
import { CollateralPlanModal } from "./collateral-plan-modal";
import type { Skill } from "@/types/skill";
import type { ReferenceUrl } from "@/types/referenceUrl";
import type { CustomerProfile } from "@/types/customerProfile";
import type { TemplateFillContext } from "@/types/template";
import type { CustomerGTMData, FetchGTMDataResponse } from "@/types/gtmData";

const SIDEBAR_COLLAPSED_KEY = "chat-v2-sidebar-collapsed";

// Customer document from API
type CustomerDocument = {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  docType: string | null;
  uploadedAt: string;
};

// Helper to extract a readable title from a URL path
function getTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || "";
    const withoutExt = lastSegment.replace(/\.(md|html|htm|pdf|txt)$/i, "");
    if (withoutExt) {
      return withoutExt
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface CollapsibleKnowledgeSidebarProps {
  skills: Skill[];
  documents: { id: string; title: string; filename: string }[];
  urls: ReferenceUrl[];
  customers: CustomerProfile[];
  selectedCustomer: CustomerProfile | null;
  isLoading?: boolean;
}

type SectionId = "knowledge" | "customer" | "output";

export function CollapsibleKnowledgeSidebar({
  skills,
  documents,
  urls,
  customers,
  selectedCustomer,
  isLoading,
}: CollapsibleKnowledgeSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<SectionId, boolean>>({
    knowledge: true,
    customer: true,
    output: false,
  });

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  // Save collapsed state
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
  };

  const toggleSection = (section: SectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const {
    skillSelections,
    documentSelections,
    urlSelections,
    customerSelections,
    toggleSkill,
    toggleDocument,
    toggleUrl,
    toggleCustomer,
    selectAllSkills,
    selectNoSkills,
    selectAllDocuments,
    selectNoDocuments,
    selectAllUrls,
    selectNoUrls,
    selectAllCustomers,
    selectNoCustomers,
  } = useSelectionStore();

  // Extract library URLs from selected skills
  const libraryUrls = useMemo(() => {
    const selectedSkillIds = Array.from(skillSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);

    const urlsFromSkills: Array<{ url: string; title: string; skillTitle: string }> = [];

    skills
      .filter((skill) => selectedSkillIds.includes(skill.id))
      .forEach((skill) => {
        skill.sourceUrls?.forEach((sourceUrl) => {
          urlsFromSkills.push({
            url: sourceUrl.url,
            title: sourceUrl.title || sourceUrl.url.split("/").pop() || sourceUrl.url,
            skillTitle: skill.title,
          });
        });
      });

    return urlsFromSkills;
  }, [skills, skillSelections]);

  // Fetch customer documents when customer is selected
  const [customerDocuments, setCustomerDocuments] = useState<CustomerDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchCustomerDocuments = useCallback(async (customerId: string) => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setCustomerDocuments(data.data?.documents || []);
      } else {
        setCustomerDocuments([]);
      }
    } catch {
      setCustomerDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomer?.id) {
      fetchCustomerDocuments(selectedCustomer.id);
    } else {
      setCustomerDocuments([]);
    }
  }, [selectedCustomer?.id, fetchCustomerDocuments]);

  // Group documents by docType
  const groupedDocs = useMemo(() => {
    const groups: Record<string, CustomerDocument[]> = {
      proposal: [],
      meeting_notes: [],
      requirements: [],
      contract: [],
      other: [],
    };

    customerDocuments.forEach((doc) => {
      const type = doc.docType || "other";
      if (groups[type]) {
        groups[type].push(doc);
      } else {
        groups.other.push(doc);
      }
    });

    return groups;
  }, [customerDocuments]);

  // Fetch GTM data from Snowflake when customer has salesforceId
  const [gtmData, setGtmData] = useState<CustomerGTMData | null>(null);
  const [gtmLoading, setGtmLoading] = useState(false);
  const [gtmError, setGtmError] = useState<string | null>(null);
  const [showCollateralModal, setShowCollateralModal] = useState(false);

  const fetchGTMData = useCallback(async (salesforceId: string) => {
    setGtmLoading(true);
    setGtmError(null);
    try {
      const res = await fetch(`/api/snowflake/customer-data?salesforceAccountId=${encodeURIComponent(salesforceId)}&gongCallLimit=5&hubspotActivityLimit=10`);
      if (res.status === 503) {
        // Snowflake not configured - not an error, just unavailable
        setGtmData(null);
        setGtmError("Snowflake not configured");
      } else if (res.ok) {
        const data: FetchGTMDataResponse = await res.json();
        setGtmData(data.data);
      } else {
        setGtmData(null);
        setGtmError("Failed to load GTM data");
      }
    } catch {
      setGtmData(null);
      setGtmError("Failed to load GTM data");
    } finally {
      setGtmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomer?.salesforceId) {
      fetchGTMData(selectedCustomer.salesforceId);
    } else {
      setGtmData(null);
      setGtmError(null);
    }
  }, [selectedCustomer?.salesforceId, fetchGTMData]);

  // Build template context from selected items
  const templateContext: TemplateFillContext = useMemo(() => {
    const selectedSkillIds = Array.from(skillSelections.entries())
      .filter(([, selected]) => selected)
      .map(([id]) => id);

    const selectedSkills = skills
      .filter((s) => selectedSkillIds.includes(s.id))
      .map((s) => ({ id: s.id, title: s.title, content: s.content }));

    return {
      customer: selectedCustomer
        ? {
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            industry: selectedCustomer.industry || undefined,
            region: selectedCustomer.region || undefined,
            tier: selectedCustomer.tier || undefined,
            content: selectedCustomer.content || undefined,
            considerations: selectedCustomer.considerations || undefined,
          }
        : undefined,
      skills: selectedSkills.length > 0 ? selectedSkills : undefined,
      gtm: gtmData
        ? {
            gongCalls: gtmData.gongCalls.map((c) => ({
              id: c.id,
              title: c.title,
              date: c.date,
              summary: c.summary,
              participants: c.participants,
            })),
            hubspotActivities: gtmData.hubspotActivities.map((a) => ({
              id: a.id,
              type: a.type,
              date: a.date,
              subject: a.subject,
              content: a.content,
            })),
            lookerMetrics: gtmData.lookerMetrics.map((m) => ({
              period: m.period,
              metrics: m.metrics,
            })),
          }
        : undefined,
    };
  }, [selectedCustomer, skills, skillSelections, gtmData]);

  if (isLoading) {
    return (
      <div className="h-full p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Collapsed view - icon strip
  if (isCollapsed) {
    return (
      <div className="h-full w-12 border-l border-border bg-muted/30 flex flex-col items-center py-2 gap-2">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleCollapsed}>
                <PanelRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Expand sidebar</TooltipContent>
          </Tooltip>

          <div className="w-8 h-px bg-border my-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsCollapsed(false);
                  setExpandedSections((prev) => ({ ...prev, knowledge: true }));
                }}
              >
                <BookOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Knowledge Library</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsCollapsed(false);
                  setExpandedSections((prev) => ({ ...prev, customer: true }));
                }}
              >
                <Database className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Customer Info & Docs</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsCollapsed(false);
                  setExpandedSections((prev) => ({ ...prev, output: true }));
                }}
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Output / Templates</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col border-l border-border">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-sm font-medium">Context</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleCollapsed}>
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Section 1: Knowledge Library */}
        <Card>
          <CardHeader className="py-2 px-3">
            <button
              onClick={() => toggleSection("knowledge")}
              className="w-full flex items-center justify-between"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Knowledge Library
              </CardTitle>
              {expandedSections.knowledge ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {expandedSections.knowledge && (
            <CardContent className="py-2 px-3 space-y-3">
              {/* Skills */}
              <KnowledgeSourceList
                title="Skills"
                icon={<BookOpen className="h-4 w-4" />}
                items={skills.map((s) => ({ id: s.id, label: s.title }))}
                selections={skillSelections}
                onToggle={toggleSkill}
                onSelectAll={selectAllSkills}
                onSelectNone={selectNoSkills}
                emptyMessage="No skills available"
                compact
              />

              {/* Library URLs */}
              {libraryUrls.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Link2 className="h-3 w-3" />
                    Library URLs ({libraryUrls.length})
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-0.5">
                    {libraryUrls.slice(0, 5).map((item, idx) => (
                      <TooltipProvider key={`${item.url}-${idx}`} delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted transition-colors">
                              <Globe className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 break-all">{item.url}</p>
                            <p className="text-xs text-primary mt-1">From: {item.skillTitle}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                    {libraryUrls.length > 5 && (
                      <span className="text-xs text-muted-foreground pl-2">
                        +{libraryUrls.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Documents */}
              <KnowledgeSourceList
                title="Documents"
                icon={<FileText className="h-4 w-4" />}
                items={documents.map((d) => ({ id: d.id, label: d.title || d.filename }))}
                selections={documentSelections}
                onToggle={toggleDocument}
                onSelectAll={selectAllDocuments}
                onSelectNone={selectNoDocuments}
                emptyMessage="No documents available"
                compact
              />

              {/* URLs */}
              <KnowledgeSourceList
                title="URLs"
                icon={<Globe className="h-4 w-4" />}
                items={urls.map((u) => ({
                  id: u.id,
                  label: getTitleFromUrl(u.url),
                  tooltip: u.url,
                }))}
                selections={urlSelections}
                onToggle={toggleUrl}
                onSelectAll={selectAllUrls}
                onSelectNone={selectNoUrls}
                emptyMessage="No URLs available"
                compact
              />
            </CardContent>
          )}
        </Card>

        {/* Section 2: Customer Information & Documents */}
        <Card>
          <CardHeader className="py-2 px-3">
            <button
              onClick={() => toggleSection("customer")}
              className="w-full flex items-center justify-between"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Customer Info & Docs
                {selectedCustomer && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({selectedCustomer.name})
                  </span>
                )}
              </CardTitle>
              {expandedSections.customer ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {expandedSections.customer && (
            <CardContent className="py-2 px-3 space-y-3">
              {/* Customer selector (for context injection) */}
              <KnowledgeSourceList
                title="Customer Profiles"
                icon={<FileText className="h-4 w-4" />}
                items={customers.map((c) => ({ id: c.id, label: c.name }))}
                selections={customerSelections}
                onToggle={toggleCustomer}
                onSelectAll={selectAllCustomers}
                onSelectNone={selectNoCustomers}
                emptyMessage="No customers available"
                compact
              />

              {selectedCustomer ? (
                <>
                  {/* Customer documents */}
                  {docsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading documents...
                    </div>
                  ) : customerDocuments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No documents uploaded for this customer
                    </p>
                  ) : (
                    <>
                      {/* Proposals */}
                      {groupedDocs.proposal.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <FileCheck className="h-3 w-3" />
                            Proposals ({groupedDocs.proposal.length})
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.proposal.map((doc) => (
                              <div key={doc.id} className="text-xs truncate" title={doc.filename}>
                                {doc.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Meeting Notes */}
                      {groupedDocs.meeting_notes.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <StickyNote className="h-3 w-3" />
                            Meeting Notes ({groupedDocs.meeting_notes.length})
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.meeting_notes.map((doc) => (
                              <div key={doc.id} className="text-xs truncate" title={doc.filename}>
                                {doc.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Requirements */}
                      {groupedDocs.requirements.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            Requirements ({groupedDocs.requirements.length})
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.requirements.map((doc) => (
                              <div key={doc.id} className="text-xs truncate" title={doc.filename}>
                                {doc.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contracts */}
                      {groupedDocs.contract.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <FileCheck className="h-3 w-3" />
                            Contracts ({groupedDocs.contract.length})
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.contract.map((doc) => (
                              <div key={doc.id} className="text-xs truncate" title={doc.filename}>
                                {doc.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other */}
                      {groupedDocs.other.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            Other Documents ({groupedDocs.other.length})
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.other.map((doc) => (
                              <div key={doc.id} className="text-xs truncate" title={doc.filename}>
                                {doc.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* GTM Data section - Snowflake integration */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Database className="h-3 w-3" />
                      GTM Data (Snowflake)
                    </div>

                    {!selectedCustomer.salesforceId ? (
                      <p className="text-xs text-amber-600 pl-5">
                        Not linked to Salesforce. Link to access GTM data.
                      </p>
                    ) : gtmLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading GTM data...
                      </div>
                    ) : gtmError === "Snowflake not configured" ? (
                      <p className="text-xs text-muted-foreground pl-5">
                        Snowflake not configured. Contact admin.
                      </p>
                    ) : gtmError ? (
                      <p className="text-xs text-destructive pl-5">{gtmError}</p>
                    ) : gtmData ? (
                      <div className="space-y-2 pl-2">
                        {/* Gong Calls */}
                        {gtmData.gongCalls.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              Gong Calls ({gtmData.gongCalls.length})
                            </div>
                            <div className="space-y-0.5 pl-5 max-h-20 overflow-y-auto">
                              {gtmData.gongCalls.map((call) => (
                                <TooltipProvider key={call.id} delayDuration={300}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="text-xs truncate cursor-help">
                                        {call.title}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="font-medium">{call.title}</p>
                                      <p className="text-xs text-muted-foreground">{call.date}</p>
                                      {call.summary && (
                                        <p className="text-xs mt-1">{call.summary.slice(0, 200)}...</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* HubSpot Activities */}
                        {gtmData.hubspotActivities.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              HubSpot ({gtmData.hubspotActivities.length})
                            </div>
                            <div className="space-y-0.5 pl-5 max-h-20 overflow-y-auto">
                              {gtmData.hubspotActivities.slice(0, 5).map((activity) => (
                                <div key={activity.id} className="text-xs truncate flex items-center gap-1">
                                  {activity.type === "email" && <Mail className="h-2.5 w-2.5" />}
                                  {activity.type === "call" && <Phone className="h-2.5 w-2.5" />}
                                  {activity.type === "meeting" && <Calendar className="h-2.5 w-2.5" />}
                                  {activity.type === "note" && <StickyNote className="h-2.5 w-2.5" />}
                                  {activity.subject}
                                </div>
                              ))}
                              {gtmData.hubspotActivities.length > 5 && (
                                <span className="text-xs text-muted-foreground">
                                  +{gtmData.hubspotActivities.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Looker Metrics */}
                        {gtmData.lookerMetrics.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <BarChart3 className="h-3 w-3" />
                              Metrics ({gtmData.lookerMetrics.length} periods)
                            </div>
                            <div className="text-xs text-muted-foreground pl-5">
                              Latest: {gtmData.lookerMetrics[0]?.period}
                            </div>
                          </div>
                        )}

                        {gtmData.gongCalls.length === 0 &&
                          gtmData.hubspotActivities.length === 0 &&
                          gtmData.lookerMetrics.length === 0 && (
                            <p className="text-xs text-muted-foreground pl-3">
                              No GTM data found for this customer
                            </p>
                          )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground pl-5">
                        Linked to Salesforce. Loading...
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Select a customer from the Focus Bar to see their documents
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* Section 3: Output / Templates */}
        <Card>
          <CardHeader className="py-2 px-3">
            <button
              onClick={() => toggleSection("output")}
              className="w-full flex items-center justify-between"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <FileDown className="h-4 w-4" />
                Output / Templates
              </CardTitle>
              {expandedSections.output ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {expandedSections.output && (
            <CardContent className="py-2 px-3 space-y-3">
              {/* Plan Collateral Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setShowCollateralModal(true)}
              >
                <Sparkles className="h-4 w-4 text-primary" />
                Plan Collateral
              </Button>

              <div className="border-t border-border pt-3">
                <TemplateSelector context={templateContext} />
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Collateral Planning Modal */}
      <CollateralPlanModal
        isOpen={showCollateralModal}
        onClose={() => setShowCollateralModal(false)}
        customer={selectedCustomer}
        skills={skills}
        gtmData={gtmData}
        onApplyPlan={(plan) => {
          // For now, just log the plan - could be used to auto-fill templates
          console.log("Collateral plan applied:", plan);
        }}
      />
    </div>
  );
}
