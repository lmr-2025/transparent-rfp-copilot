import { UserRole } from "@prisma/client";

export type UserSession = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: UserRole;
};

export type OwnedResource = {
  ownerId?: string | null;
  assignedUsers?: string[] | null;
};

/**
 * Check if user is an admin
 */
export function isAdmin(user: UserSession | null | undefined): boolean {
  return user?.role === "ADMIN";
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
