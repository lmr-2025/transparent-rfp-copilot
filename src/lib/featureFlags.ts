/**
 * Feature Flags Configuration
 *
 * Simple environment-based feature flags for phased rollout.
 * Set these in your .env file to enable/disable features per deployment.
 *
 * Usage:
 *   import { features } from "@/lib/featureFlags";
 *   if (features.chat) { ... }
 */

// Parse boolean from env var (defaults to false if not set)
function envBool(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Feature flags - read from environment variables
 *
 * Set in .env:
 *   FEATURE_CHAT_ENABLED=true
 *   FEATURE_CONTRACTS_ENABLED=false
 */
export const features = {
  // Chat interface - needs streaming/WebSocket work for production
  chat: envBool("NEXT_PUBLIC_FEATURE_CHAT_ENABLED", true),

  // Contracts module - still in development
  contracts: envBool("NEXT_PUBLIC_FEATURE_CONTRACTS_ENABLED", false),

  // Usage dashboard - ready but optional
  usage: envBool("NEXT_PUBLIC_FEATURE_USAGE_ENABLED", true),

  // Audit log - ready
  auditLog: envBool("NEXT_PUBLIC_FEATURE_AUDIT_LOG_ENABLED", true),
} as const;

/**
 * Route to feature mapping
 * Used by middleware to check if a route should be accessible
 */
export const routeFeatureMap: Record<string, keyof typeof features> = {
  "/chat": "chat",
  "/contracts": "contracts",
  "/usage": "usage",
  "/audit-log": "auditLog",
};

/**
 * Check if a route is enabled based on feature flags
 */
export function isRouteEnabled(pathname: string): boolean {
  // Check exact match first
  if (routeFeatureMap[pathname]) {
    return features[routeFeatureMap[pathname]];
  }

  // Check prefix match (e.g., /chat/sessions should check /chat)
  for (const [route, feature] of Object.entries(routeFeatureMap)) {
    if (pathname.startsWith(route + "/") || pathname === route) {
      return features[feature];
    }
  }

  // Route not mapped = always enabled
  return true;
}

/**
 * Get redirect path for disabled features
 */
export function getDisabledFeatureRedirect(): string {
  return "/projects";
}
