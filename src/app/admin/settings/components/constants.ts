import { FileText, Users, FolderKanban, Globe, FileCheck, User, Code, MessageSquare } from "lucide-react";
import { IntegrationConfig, AuditEntityType, AuditAction } from "./types";

export const INTEGRATIONS: Record<string, IntegrationConfig> = {
  salesforce: {
    name: "Salesforce",
    description: "Pull customer data from Salesforce to enrich profiles",
    envVars: [
      { key: "SALESFORCE_CLIENT_ID", label: "Client ID", placeholder: "3MVG9..." },
      { key: "SALESFORCE_CLIENT_SECRET", label: "Client Secret", placeholder: "ABC123...", isSecret: true },
      { key: "SALESFORCE_REFRESH_TOKEN", label: "Refresh Token", placeholder: "5Aep861...", isSecret: true },
      { key: "SALESFORCE_INSTANCE_URL", label: "Instance URL", placeholder: "https://yourcompany.salesforce.com" },
    ],
    docsUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm",
  },
  slack: {
    name: "Slack",
    description: "Send notifications to Slack channels",
    envVars: [
      { key: "SLACK_WEBHOOK_URL", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", isSecret: true },
    ],
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
};

export const FEATURE_LABELS: Record<string, string> = {
  questions: "Quick Questions",
  chat: "The Oracle (Chat)",
  "skills-suggest": "Knowledge Gremlin (Skills)",
  "customers-suggest": "The Rolodex (Customers)",
  "contracts-analyze": "Clause Checker (Contracts)",
  projects: "Project Answerer",
};

export const entityTypeConfig: Record<
  AuditEntityType,
  { label: string; icon: typeof FileText; color: string }
> = {
  SKILL: { label: "Skill", icon: FileText, color: "#0ea5e9" },
  CUSTOMER: { label: "Customer", icon: Users, color: "#8b5cf6" },
  PROJECT: { label: "Project", icon: FolderKanban, color: "#f97316" },
  DOCUMENT: { label: "Document", icon: FileText, color: "#10b981" },
  REFERENCE_URL: { label: "URL", icon: Globe, color: "#6366f1" },
  CONTRACT: { label: "Contract", icon: FileCheck, color: "#ec4899" },
  USER: { label: "User", icon: User, color: "#64748b" },
  SETTING: { label: "Setting", icon: FileText, color: "#94a3b8" },
  PROMPT: { label: "Prompt", icon: FileText, color: "#f59e0b" },
  CONTEXT_SNIPPET: { label: "Snippet", icon: Code, color: "#84cc16" },
  ANSWER: { label: "Answer", icon: MessageSquare, color: "#14b8a6" },
};

export const actionConfig: Record<AuditAction, { label: string; color: string }> = {
  CREATED: { label: "Created", color: "#10b981" },
  UPDATED: { label: "Updated", color: "#0ea5e9" },
  DELETED: { label: "Deleted", color: "#ef4444" },
  VIEWED: { label: "Viewed", color: "#64748b" },
  EXPORTED: { label: "Exported", color: "#8b5cf6" },
  OWNER_ADDED: { label: "Owner Added", color: "#10b981" },
  OWNER_REMOVED: { label: "Owner Removed", color: "#f97316" },
  STATUS_CHANGED: { label: "Status Changed", color: "#0ea5e9" },
  REFRESHED: { label: "Refreshed", color: "#6366f1" },
  MERGED: { label: "Merged", color: "#ec4899" },
  CORRECTED: { label: "Corrected", color: "#f59e0b" },
  APPROVED: { label: "Approved", color: "#10b981" },
  REVIEW_REQUESTED: { label: "Review Requested", color: "#8b5cf6" },
  FLAG_RESOLVED: { label: "Flag Resolved", color: "#22c55e" },
};

export const TABS = [
  { id: "branding", label: "Branding" },
  { id: "integrations", label: "Integrations" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "categories", label: "Categories" },
  { id: "usage", label: "API Usage" },
  { id: "audit", label: "Audit Log" },
] as const;

export type TabId = (typeof TABS)[number]["id"];
