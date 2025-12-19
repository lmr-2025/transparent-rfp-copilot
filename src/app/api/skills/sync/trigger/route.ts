import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * POST /api/skills/sync/trigger - Manually trigger git → database sync
 *
 * @description Runs the sync-skills-to-db script to sync git changes to database.
 * Useful when engineers edit skills directly in git and need to update the database.
 *
 * @authentication Required - returns 401 if not authenticated
 * @authorization Requires ADMIN or SKILL_MANAGER capability
 *
 * @returns {object} 200 - Sync result
 * @returns {string} message - Success message
 * @returns {string} output - Sync script output
 * @returns {{ error: string }} 401 - Unauthorized
 * @returns {{ error: string }} 403 - Forbidden (insufficient permissions)
 * @returns {{ error: string }} 500 - Server error
 *
 * @example
 * POST /api/skills/sync/trigger
 * Response: {
 *   "message": "Sync completed successfully",
 *   "output": "✨ Created: 2\n🔄 Updated: 5\n⏭️  Skipped: 10\n❌ Errors: 0\n📁 Total: 17"
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  // Check if user has permission to trigger sync
  const canManageSkills =
    auth.session.user.role === "ADMIN" ||
    auth.session.user.capabilities?.includes("MANAGE_KNOWLEDGE");

  if (!canManageSkills) {
    return errors.forbidden("You don't have permission to trigger skill sync");
  }

  try {
    logger.info("Manual skill sync triggered", {
      userId: auth.session.user.id,
      email: auth.session.user.email,
    });

    // Run the sync script
    const { stdout, stderr } = await execAsync("npm run sync:skills", {
      cwd: process.cwd(),
      timeout: 60000, // 1 minute timeout
    });

    // Log the output
    logger.info("Skill sync completed", {
      userId: auth.session.user.id,
      stdout: stdout.substring(0, 500), // Truncate to avoid huge logs
      stderr: stderr ? stderr.substring(0, 500) : undefined,
    });

    return apiSuccess({
      message: "Sync completed successfully",
      output: stdout,
      warnings: stderr || undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const execError = error as { stdout?: string; stderr?: string };

    logger.error("Failed to trigger skill sync", error, {
      route: "/api/skills/sync/trigger",
      userId: auth.session.user.id,
      stdout: execError.stdout,
      stderr: execError.stderr,
    });

    // Return the error output if available (helpful for debugging)
    const errorDetails = execError.stderr || execError.stdout || errorMessage;
    return errors.internal(
      `Failed to sync skills: ${errorDetails.substring(0, 200)}`
    );
  }
}
