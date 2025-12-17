import { UserRole, Capability } from "@prisma/client";
import { hasCapability, hasAnyCapability } from "./capabilities";

export type UserSession = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: UserRole;
  capabilities?: Capability[];
};

export type OwnedResource = {
  ownerId?: string | null;
  assignedUsers?: string[] | null;
};

/**
 * Check if user is an admin (has ADMIN capability)
 */
export function isAdmin(user: UserSession | null | undefined): boolean {
  // Check capabilities first (new system)
  if (user?.capabilities) {
    return hasCapability(user.capabilities, "ADMIN");
  }
  // Fall back to legacy role check
  return user?.role === "ADMIN";
}

/**
 * Check if user has prompt admin access
 */
export function isPromptAdmin(user: UserSession | null | undefined): boolean {
  if (user?.capabilities) {
    return hasAnyCapability(user.capabilities, ["MANAGE_PROMPTS", "ADMIN"]);
  }
  return user?.role === "ADMIN" || user?.role === "PROMPT_ADMIN";
}

/**
 * Check if user can access a resource
 * Access is granted if:
 * - User is an admin
 * - User owns the resource
 * - User is in the assignedUsers array
 */
export function canAccessResource(
  user: UserSession | null | undefined,
  resource: OwnedResource
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (resource.ownerId === user.id) return true;
  if (resource.assignedUsers?.includes(user.id)) return true;
  return false;
}

/**
 * Check if user can edit a resource
 * Edit is allowed if:
 * - User is an admin
 * - User owns the resource
 */
export function canEditResource(
  user: UserSession | null | undefined,
  resource: OwnedResource
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (resource.ownerId === user.id) return true;
  return false;
}

/**
 * Check if user can delete a resource
 * Same rules as canEditResource
 */
export function canDeleteResource(
  user: UserSession | null | undefined,
  resource: OwnedResource
): boolean {
  return canEditResource(user, resource);
}

/**
 * Check if user can access admin features (Backstage)
 */
export function canAccessBackstage(user: UserSession | null | undefined): boolean {
  if (user?.capabilities) {
    // Any admin-level capability grants backstage access
    return hasAnyCapability(user.capabilities, [
      "ADMIN",
      "MANAGE_USERS",
      "MANAGE_PROMPTS",
      "MANAGE_KNOWLEDGE",
      "VIEW_ORG_DATA",
    ]);
  }
  return isAdmin(user);
}

/**
 * Check if user can view org-wide data (question log, accuracy metrics)
 */
export function canViewOrgData(user: UserSession | null | undefined): boolean {
  if (user?.capabilities) {
    return hasAnyCapability(user.capabilities, ["VIEW_ORG_DATA", "ADMIN"]);
  }
  return isAdmin(user);
}

/**
 * Check if user can review answers
 */
export function canReviewAnswers(user: UserSession | null | undefined): boolean {
  if (user?.capabilities) {
    return hasAnyCapability(user.capabilities, ["REVIEW_ANSWERS", "ADMIN"]);
  }
  return isAdmin(user);
}

/**
 * Check if user can manage knowledge (skills, documents, URLs)
 */
export function canManageKnowledge(user: UserSession | null | undefined): boolean {
  if (user?.capabilities) {
    return hasAnyCapability(user.capabilities, ["MANAGE_KNOWLEDGE", "ADMIN"]);
  }
  return isAdmin(user);
}

/**
 * Check if user can manage users
 */
export function canManageUsers(user: UserSession | null | undefined): boolean {
  if (user?.capabilities) {
    return hasAnyCapability(user.capabilities, ["MANAGE_USERS", "ADMIN"]);
  }
  return isAdmin(user);
}

/**
 * Filter resources to only those the user can access
 */
export function filterAccessibleResources<T extends OwnedResource>(
  user: UserSession | null | undefined,
  resources: T[]
): T[] {
  if (!user) return [];
  if (isAdmin(user)) return resources;
  return resources.filter((r) => canAccessResource(user, r));
}
