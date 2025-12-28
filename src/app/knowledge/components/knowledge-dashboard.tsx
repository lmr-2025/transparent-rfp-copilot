"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Filter, Info } from "lucide-react";
import { useMemo } from "react";
import type { Skill } from "@/types/skill";

interface KnowledgeDashboardProps {
  skills: Skill[];
  categories: { id: string; name: string }[];
}

export function KnowledgeDashboard({ skills, categories }: KnowledgeDashboardProps) {
  // Calculate tier stats
  const tierStats = useMemo(() => {
    const stats = {
      core: 0,
      extended: 0,
      library: 0,
      withOverrides: 0,
    };

    skills.forEach((skill) => {
      // Count by default tier
      if (skill.tier === "core") stats.core++;
      else if (skill.tier === "extended") stats.extended++;
      else stats.library++;

      // Count skills with overrides
      if (skill.tierOverrides && Object.keys(skill.tierOverrides).length > 0) {
        stats.withOverrides++;
      }
    });

    return stats;
  }, [skills]);

  // Calculate category stats
  const categoryStats = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    skills.forEach((skill) => {
      skill.categories?.forEach((cat) => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    });
    return categoryCounts;
  }, [skills]);

  const topCategories = useMemo(() => {
    return Object.entries(categoryStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [categoryStats]);

  // Calculate most-used skills
  const mostUsedSkills = useMemo(() => {
    return skills
      .filter((skill) => skill.usageCount && skill.usageCount > 0)
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 10);
  }, [skills]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{skills.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Core Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{tierStats.core}</div>
            <p className="text-xs text-muted-foreground">Always loaded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Extended Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{tierStats.extended}</div>
            <p className="text-xs text-muted-foreground">Searched in category</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Library Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{tierStats.library}</div>
            <p className="text-xs text-muted-foreground">Searched globally</p>
          </CardContent>
        </Card>
      </div>

      {/* Progressive Loading Explainer */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            <CardTitle>Progressive Skill Loading</CardTitle>
          </div>
          <CardDescription>
            Skills are loaded in tiers to minimize context window usage while maintaining response quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tier 1: Core */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-700">1</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-blue-900">Core Tier</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  {tierStats.core} skills
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Always loaded first.</strong> Essential skills that should be available for every question.
                Perfect for: critical company info, frequently-needed knowledge, high-priority content.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Tier 2: Extended */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-green-700">2</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-green-900">Extended Tier</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                  {tierStats.extended} skills
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Searched within selected categories</strong> if core skills don't confidently answer.
                Perfect for: important category-specific knowledge, specialized workflows, detailed procedures.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Tier 3: Library */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-700">3</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">Library Tier</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {tierStats.library} skills
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Searched across all categories</strong> as a last resort if extended skills don't answer.
                Perfect for: edge cases, rarely-needed info, reference material, archived knowledge.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category-Specific Overrides */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-purple-600" />
            <CardTitle>Category-Specific Tier Overrides</CardTitle>
          </div>
          <CardDescription>
            Fine-tune skill importance by category for better relevance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-purple-900">
                <p className="font-medium mb-2">Why use overrides?</p>
                <p className="mb-2">
                  The same skill can have different importance across categories. For example:
                </p>
                <div className="space-y-1 ml-4">
                  <p>• "SSO Authentication" → <strong>Core</strong> for Security, <strong>Library</strong> for Sales</p>
                  <p>• "API Rate Limits" → <strong>Extended</strong> for Integrations, <strong>Library</strong> for Marketing</p>
                  <p>• "GDPR Compliance" → <strong>Core</strong> for Legal, <strong>Extended</strong> for Product</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Skills with category overrides</span>
              <span className="text-2xl font-bold text-purple-600">{tierStats.withOverrides}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              These skills have different tier levels for different categories, providing context-aware loading.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Most Used Skills */}
      {mostUsedSkills.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Most Used Skills</CardTitle>
            <CardDescription>Skills that are most frequently used in answers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mostUsedSkills.map((skill, index) => (
                <div key={skill.id} className="flex items-center gap-4 py-2 border-b last:border-b-0">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-700">#{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{skill.title}</span>
                      {skill.tier === "core" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Core</span>
                      )}
                      {skill.tier === "extended" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Extended</span>
                      )}
                    </div>
                    {skill.categories && skill.categories.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {skill.categories.slice(0, 2).join(", ")}
                        {skill.categories.length > 2 && " +more"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, ((skill.usageCount || 0) / (mostUsedSkills[0]?.usageCount || 1)) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-blue-600 w-16 text-right">
                      {skill.usageCount} uses
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                💡 <strong>Tip:</strong> Consider promoting heavily-used skills to the <strong>Core</strong> tier for better performance.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Most Used Skills</CardTitle>
            <CardDescription>Usage tracking will appear here once skills are used in answers</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Start answering questions to see which skills are used most frequently. This data helps you optimize your skill tier assignments.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <strong className="text-foreground">Core Tier:</strong> Keep this minimal (10-20 skills). Only essential, universally-needed knowledge.
          </div>
          <div>
            <strong className="text-foreground">Extended Tier:</strong> Category-important skills (30-50 per category). Helps when core doesn't have the answer.
          </div>
          <div>
            <strong className="text-foreground">Library Tier:</strong> Everything else. These are searched globally only when needed.
          </div>
          <div>
            <strong className="text-foreground">Use Overrides:</strong> When a skill is critical for one category but not others, set category-specific tiers.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
