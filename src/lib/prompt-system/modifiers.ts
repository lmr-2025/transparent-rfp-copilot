/**
 * Prompt Modifier Definitions
 *
 * Runtime modifiers that can be injected into prompts based on user selection.
 * Modifiers include modes (like "teach me" or "concise") and domains (like "security" or "engineering").
 */

import type { PromptModifier } from "./types";

// ============================================
// DEFAULT MODIFIERS (Mode/Domain)
// ============================================

export const defaultModifiers: PromptModifier[] = [
  // Modes
  {
    id: "mode_single",
    name: "Single Question Mode",
    type: "mode",
    tier: 3, // Open - style preference
    content: [
      "You are answering a single question from a user. Provide a thorough, conversational response:",
      "",
      "- Take time to fully explain the answer with context",
      "- If the question is ambiguous, address the most likely interpretation",
      "- Be helpful and educational",
    ].join("\n"),
  },
  {
    id: "mode_bulk",
    name: "Bulk Questionnaire Mode",
    type: "mode",
    tier: 3, // Open - style preference
    content: [
      "You are processing questions from a formal security questionnaire. Optimize for efficiency:",
      "",
      "- Be concise and direct",
      "- Use consistent terminology across responses",
      "- Keep responses scannable with clear Yes/No answers where applicable",
    ].join("\n"),
  },
  {
    id: "mode_call",
    name: "Live Call Mode",
    type: "mode",
    tier: 3, // Open - style preference
    content: [
      "**CRITICAL: LIVE CALL IN PROGRESS**",
      "",
      "The user is on a LIVE CUSTOMER CALL right now. Every second counts. Your responses MUST be:",
      "",
      "1. **ULTRA-BRIEF**: Maximum 2-3 sentences. No paragraphs. No lengthy explanations.",
      "2. **DIRECT ANSWER FIRST**: Start with the answer, not context. \"Yes, we have SOC 2\" not \"That's a great question about compliance...\"",
      "3. **SCANNABLE**: Bold key terms. Use bullets for lists. One line per point.",
      "4. **NO FILLER**: No \"That's a great question\", no \"Let me explain\", no \"I'd be happy to help\"",
      "5. **CONFIDENT**: Say what you know. If unsure, say \"I don't have that specific info\" - don't hedge.",
      "",
      "GOOD: \"**SOC 2 Type II** - Yes, certified since 2022. Annual audits.\"",
      "BAD: \"That's a great question! We take security seriously and I'd be happy to explain our SOC 2 certification journey...\"",
      "",
      "Remember: They're waiting. Keep it SHORT.",
    ].join("\n"),
  },
  // Domains
  {
    id: "domain_technical",
    name: "Technical Focus",
    type: "domain",
    tier: 3, // Open - customizable focus areas
    content: [
      "This is a technical question. Focus on:",
      "- Specific implementations (protocols, algorithms, architectures)",
      "- Integration capabilities and API details",
      "- Platform/infrastructure details",
    ].join("\n"),
  },
  {
    id: "domain_legal",
    name: "Legal Focus",
    type: "domain",
    tier: 2, // Caution - legal accuracy matters
    content: [
      "This has legal/compliance implications. Be careful to:",
      "- Only state what is explicitly documented",
      "- Reference specific certifications by name",
      "- Distinguish 'we do X' vs 'we can accommodate X upon request'",
    ].join("\n"),
  },
  {
    id: "domain_security",
    name: "Security Focus",
    type: "domain",
    tier: 2, // Caution - security accuracy matters
    content: [
      "This is security-focused. Prioritize:",
      "- Specific security controls and implementations",
      "- Access control and authentication methods",
      "- Audit logging and compliance evidence",
    ].join("\n"),
  },
];

