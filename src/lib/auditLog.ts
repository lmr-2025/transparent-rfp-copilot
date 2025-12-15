import { prisma } from "@/lib/prisma";
import { AuditEntityType, AuditAction, Prisma } from "@prisma/client";

export type AuditUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

export type AuditLogEntry = {
  entityType: AuditEntityType;
  entityId: string;
  entityTitle?: string;
  action: AuditAction;
  user?: AuditUser;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityTitle: entry.entityTitle,
        action: entry.action,
        userId: entry.user?.id,
        userEmail: entry.user?.email,
        userName: entry.user?.name,
        changes: entry.changes as Prisma.InputJsonValue | undefined,
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (error) {
    // Log but don't fail the main operation
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Compare two objects and return the differences
 */
export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fieldsToTrack?: string[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    // Skip if we have a whitelist and this field isn't in it
    if (fieldsToTrack && !fieldsToTrack.includes(key)) continue;

    // Skip internal fields
    if (key === "updatedAt" || key === "createdAt") continue;

    const beforeVal = before[key];
    const afterVal = after[key];

    // Compare as JSON strings for objects/arrays
    const beforeStr = JSON.stringify(beforeVal);
    const afterStr = JSON.stringify(afterVal);

    if (beforeStr !== afterStr) {
      changes[key] = {
        from: beforeVal,
        to: afterVal,
      };
    }
  }

  return changes;
}

/**
 * Helper to get user info from a session
 */
export function getUserFromSession(session: {
  user: { id?: string; email?: string | null; name?: string | null };
}): AuditUser {
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

/**
 * Log a skill change
 */
export async function logSkillChange(
  action: AuditAction,
  skillId: string,
  skillTitle: string,
  user?: AuditUser,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    entityType: "SKILL",
    entityId: skillId,
    entityTitle: skillTitle,
    action,
    user,
    changes,
    metadata,
  });
}

/**
 * Log a customer change
 */
export async function logCustomerChange(
  action: AuditAction,
  customerId: string,
  customerName: string,
  user?: AuditUser,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    entityType: "CUSTOMER",
    entityId: customerId,
    entityTitle: customerName,
    action,
    user,
    changes,
    metadata,
  });
}

/**
 * Log a project change
 */
export async function logProjectChange(
  action: AuditAction,
  projectId: string,
  projectName: string,
  user?: AuditUser,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    entityType: "PROJECT",
    entityId: projectId,
    entityTitle: projectName,
    action,
    user,
    changes,
    metadata,
  });
}

/**
 * Log a document change
 */
export async function logDocumentChange(
  action: AuditAction,
  documentId: string,
  documentTitle: string,
  user?: AuditUser,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    entityType: "DOCUMENT",
    entityId: documentId,
    entityTitle: documentTitle,
    action,
    user,
    changes,
    metadata,
  });
}

/**
 * Log a contract change
 */
export async function logContractChange(
  action: AuditAction,
  contractId: string,
  contractName: string,
  user?: AuditUser,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    entityType: "CONTRACT",
    entityId: contractId,
    entityTitle: contractName,
    action,
    user,
    changes,
    metadata,
  });
}

/**
 * Log a reference URL change
 */
export async function logReferenceUrlChange(
  action: AuditAction,
  urlId: string,
  urlTitle: string,
  user?: AuditUser,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    entityType: "REFERENCE_URL",
    entityId: urlId,
    entityTitle: urlTitle,
    action,
    user,
    changes,
    metadata,
  });
}

/**
 * Log a context snippet change
 */
export async function logContextSnippetChange(
  action: AuditAction,
  snippetId: string,
  snippetName: string,
  user?: AuditUser,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    entityType: "CONTEXT_SNIPPET",
    entityId: snippetId,
    entityTitle: snippetName,
    action,
    user,
    changes,
    metadata,
  });
}

// Re-export types for convenience
export { AuditEntityType, AuditAction };
