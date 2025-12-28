import {
  type PromptContext,
  type PromptTier,
} from "@/lib/promptBlocks";

// ============================================
// TYPES (UI-specific)
// ============================================

export interface BlockVariant {
  id: string;
  name: string;
  content: string;
  usedInPrompts: string[]; // Which prompts use this variant
}

export interface Block {
  id: string;
  name: string;
  description: string;
  tier: PromptTier;
  defaultContent: string;
  variants: BlockVariant[];
}

export interface Prompt {
  id: string;
  name: string;
  blocks: { blockId: string; variantId: string | null }[]; // null = use default
  color: string;
}

// Human-readable names for contexts
export const contextNames: Record<PromptContext, string> = {
  questions: "Questions",
  skills: "Skills",
  analysis: "Analysis",
  chat: "Chat",
  contracts: "Contracts",
  skill_organize: "Skill Organize",
  skill_analyze: "Skill Analyze",
  skill_refresh: "Skill Refresh",
  skill_analyze_rfp: "Skill RFP",
  skill_planning: "Skill Planning",
  customer_profile: "Customer Profile",
  prompt_optimize: "Prompt Optimize",
  instruction_builder: "Instructions",
  collateral_planning: "Collateral",
  source_url_analysis: "Source Analysis",
  group_coherence_analysis: "Coherence Check",
};

// Descriptions for where each prompt is used
export const contextDescriptions: Record<PromptContext, string> = {
  questions: "Answering individual questions from RFPs and security questionnaires",
  skills: "Managing and displaying knowledge library skills",
  analysis: "Analyzing content and generating insights",
  chat: "Main chat interface for sales reps to ask questions",
  contracts: "Reviewing and analyzing contract documents",
  skill_organize: "Categorizing and organizing skills in the knowledge library",
  skill_analyze: "Analyzing skill content for quality and completeness",
  skill_refresh: "Updating and refreshing existing skill documentation",
  skill_analyze_rfp: "Processing RFP questions to find matching skills",
  skill_planning: "Planning new skills and identifying gaps in coverage",
  customer_profile: "Generating and updating customer profile summaries",
  prompt_optimize: "Analyzing prompts for token efficiency and clarity",
  instruction_builder: "Helping users create custom instruction presets",
  collateral_planning: "Planning sales collateral and content strategy",
  source_url_analysis: "Comparing new source URLs against existing skill content for discrepancies",
  group_coherence_analysis: "Analyzing whether multiple sources within a group are coherent or conflicting",
};

// Color assignments for each context
export const contextColors: Record<PromptContext, string> = {
  questions: "blue",
  skills: "green",
  analysis: "amber",
  chat: "purple",
  contracts: "red",
  skill_organize: "teal",
  skill_analyze: "cyan",
  skill_refresh: "emerald",
  skill_analyze_rfp: "indigo",
  skill_planning: "violet",
  customer_profile: "pink",
  prompt_optimize: "orange",
  instruction_builder: "rose",
  collateral_planning: "slate",
  source_url_analysis: "yellow",
  group_coherence_analysis: "lime",
};

// Prompt categories for grouped navigation
export type PromptCategory = {
  id: string;
  name: string;
  contexts: PromptContext[];
};

export const promptCategories: PromptCategory[] = [
  {
    id: "core",
    name: "Core",
    contexts: ["questions", "chat", "skills", "contracts"],
  },
  {
    id: "skill_mgmt",
    name: "Skill Management",
    contexts: ["skill_analyze", "skill_refresh", "skill_analyze_rfp", "skill_organize", "skill_planning"],
  },
  {
    id: "analysis",
    name: "Analysis & Planning",
    contexts: ["analysis", "customer_profile", "prompt_optimize", "collateral_planning"],
  },
  {
    id: "builder",
    name: "Builders",
    contexts: ["instruction_builder"],
  },
];

// App features and their prompt/source mappings
export type AppFeature = {
  id: string;
  name: string;
  description: string;
  prompts: PromptContext[];
  sources: string[]; // which runtime sources are injected
  usesPersona: boolean;
};

export const appFeatures: AppFeature[] = [
  {
    id: "chat",
    name: "Knowledge Chat",
    description: "AI-powered Q&A for sales reps",
    prompts: ["chat"],
    sources: ["Skills", "Documents", "Customer Profile", "GTM Data", "Persona", "Conversation History"],
    usesPersona: true,
  },
  {
    id: "rfp",
    name: "RFP Processing",
    description: "Answer security questionnaires and RFPs",
    prompts: ["questions", "skill_analyze_rfp"],
    sources: ["Skills", "Customer Profile"],
    usesPersona: false,
  },
  {
    id: "collateral",
    name: "Collateral Builder",
    description: "Generate sales decks, one-pagers, documents",
    prompts: ["collateral_planning"],
    sources: ["Skills", "Customer Profile", "GTM Data", "Templates", "Persona"],
    usesPersona: true,
  },
  {
    id: "contracts",
    name: "Contract Review",
    description: "Analyze and review contract documents",
    prompts: ["contracts"],
    sources: ["Skills", "Documents"],
    usesPersona: false,
  },
  {
    id: "customers",
    name: "Customer Profiles",
    description: "Generate and manage customer summaries",
    prompts: ["customer_profile"],
    sources: ["Documents", "GTM Data"],
    usesPersona: false,
  },
  {
    id: "knowledge",
    name: "Knowledge Library",
    description: "Manage, analyze, and organize skills",
    prompts: ["skills", "skill_analyze", "skill_refresh", "skill_organize", "skill_planning", "analysis"],
    sources: ["Skills", "Documents"],
    usesPersona: false,
  },
  {
    id: "personas",
    name: "Persona Builder",
    description: "AI-assisted persona creation",
    prompts: ["instruction_builder"],
    sources: [],
    usesPersona: false,
  },
];

// Runtime context templates - these get injected at request time
export type RuntimePrompt = {
  id: string;
  name: string;
  description: string;
  template: string;
  usedIn: string[]; // which contexts use this
};

export const runtimePrompts: RuntimePrompt[] = [
  {
    id: "rt_skills",
    name: "Skills Context",
    description: "How skills from the knowledge library are formatted",
    usedIn: ["chat", "questions"],
    template: `=== SKILLS (Primary Knowledge Sources) ===

=== SKILL 1: {{title}} ===
{{content}}

=== SKILL 2: {{title}} ===
{{content}}

[... additional skills ...]`,
  },
  {
    id: "rt_documents",
    name: "Documents Context",
    description: "How uploaded documents are formatted",
    usedIn: ["chat"],
    template: `=== DOCUMENTS (Supporting Documentation) ===

=== DOCUMENT 1: {{title}} ===
{{content}}

[... additional documents ...]`,
  },
  {
    id: "rt_customer",
    name: "Customer Profile",
    description: "Customer context with industry and considerations",
    usedIn: ["chat", "questions"],
    template: `=== CUSTOMER PROFILE: {{name}} ===

Industry: {{industry}}

## Overview
{{content}}

## Key Considerations
{{considerations}}

## Customer Documents
[... attached documents ...]`,
  },
  {
    id: "rt_gtm",
    name: "GTM Data",
    description: "Sales intelligence from Gong, HubSpot, Looker",
    usedIn: ["chat"],
    template: `=== GTM DATA (Sales Intelligence) ===

# GTM Data for {{customerName}}

## Gong Call Transcripts
### Call: {{title}} ({{date}})
Duration: {{duration}} | Participants: {{participants}}
Summary: {{summary}}

## HubSpot Activities
### {{type}}: {{subject}} ({{date}})
{{content}}

## Business Metrics ({{period}})
{{metrics}}`,
  },
  {
    id: "rt_instructions",
    name: "User Instructions",
    description: "Custom instruction presets selected by user",
    usedIn: ["chat"],
    template: `## User Instructions

{{expanded_instructions}}

[Note: May contain {{snippet_key}} placeholders that get interpolated from stored snippets]`,
  },
  {
    id: "rt_call_mode",
    name: "Call Mode Override",
    description: "Ultra-brief mode for live customer calls (appears LAST)",
    usedIn: ["chat"],
    template: `## CRITICAL: LIVE CALL MODE ACTIVE

You are supporting a sales rep who is CURRENTLY ON A LIVE CALL with a customer.

OVERRIDE ALL PREVIOUS VERBOSITY RULES:
- Maximum 2-3 sentences per response
- Lead with the direct answer
- No bullet points or formatting unless essential
- No elaboration unless explicitly requested
- Speak as if whispering quick tips to the rep

The rep needs instant, actionable responses they can relay immediately.`,
  },
  {
    id: "rt_conversation",
    name: "Conversation History",
    description: "Previous messages in the chat",
    usedIn: ["chat"],
    template: `[Passed as messages array, not in system prompt]

{ role: "user", content: "..." },
{ role: "assistant", content: "..." },
...`,
  },
];

export const promptColors: Record<string, { bg: string; text: string; light: string }> = {
  blue: { bg: "bg-blue-500", text: "text-blue-700", light: "bg-blue-50" },
  purple: { bg: "bg-purple-500", text: "text-purple-700", light: "bg-purple-50" },
  green: { bg: "bg-green-500", text: "text-green-700", light: "bg-green-50" },
  red: { bg: "bg-red-500", text: "text-red-700", light: "bg-red-50" },
  amber: { bg: "bg-amber-500", text: "text-amber-700", light: "bg-amber-50" },
  teal: { bg: "bg-teal-500", text: "text-teal-700", light: "bg-teal-50" },
  cyan: { bg: "bg-cyan-500", text: "text-cyan-700", light: "bg-cyan-50" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-700", light: "bg-emerald-50" },
  indigo: { bg: "bg-indigo-500", text: "text-indigo-700", light: "bg-indigo-50" },
  violet: { bg: "bg-violet-500", text: "text-violet-700", light: "bg-violet-50" },
  pink: { bg: "bg-pink-500", text: "text-pink-700", light: "bg-pink-50" },
  orange: { bg: "bg-orange-500", text: "text-orange-700", light: "bg-orange-50" },
  rose: { bg: "bg-rose-500", text: "text-rose-700", light: "bg-rose-50" },
  slate: { bg: "bg-slate-500", text: "text-slate-700", light: "bg-slate-50" },
  yellow: { bg: "bg-yellow-500", text: "text-yellow-700", light: "bg-yellow-50" },
  lime: { bg: "bg-lime-500", text: "text-lime-700", light: "bg-lime-50" },
};

// API block format
export type ApiBlock = {
  id: string;
  name: string;
  description: string;
  tier: PromptTier;
  variants: Record<string, string>;
};
