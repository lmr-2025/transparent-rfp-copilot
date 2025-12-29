import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// GET - Fetch a specific chat session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const { id } = await params;

    const chatSession = await prisma.chatSession.findFirst({
      where: userId ? { id, userId } : { id },
      include: {
        customers: {
          include: {
            customer: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!chatSession) {
      return errors.notFound("Session");
    }

    return apiSuccess({ session: chatSession });
  } catch (error) {
    logger.error("Failed to fetch chat session", error, { route: "/api/chat-sessions/[id]" });
    return errors.internal("Failed to fetch chat session");
  }
}

// PUT - Update a chat session (add messages, update title)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const { id } = await params;
    const body = await request.json();
    const { title, messages, skillsUsed, documentsUsed, customersUsed, urlsUsed } = body;

    // Find the session (must belong to user if authenticated)
    const existingSession = await prisma.chatSession.findFirst({
      where: userId ? { id, userId } : { id },
    });

    if (!existingSession) {
      return errors.notFound("Session");
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (messages !== undefined) updateData.messages = messages;
    if (skillsUsed !== undefined) updateData.skillsUsed = skillsUsed;
    if (documentsUsed !== undefined) updateData.documentsUsed = documentsUsed;
    if (customersUsed !== undefined) updateData.customersUsed = customersUsed;
    if (urlsUsed !== undefined) updateData.urlsUsed = urlsUsed;

    // If customers are being updated, sync the join table
    if (customersUsed !== undefined) {
      const customerIds: string[] = Array.isArray(customersUsed)
        ? customersUsed
            .filter((c: { id?: string }) => c && c.id)
            .map((c: { id: string }) => c.id)
        : [];

      // Use transaction to update both JSON and join table atomically
      const updated = await prisma.$transaction(async (tx) => {
        // Delete existing customer links
        await tx.chatSessionCustomer.deleteMany({
          where: { chatSessionId: id },
        });

        // Create new customer links
        if (customerIds.length > 0) {
          await tx.chatSessionCustomer.createMany({
            data: customerIds.map((customerId) => ({
              chatSessionId: id,
              customerId,
            })),
            skipDuplicates: true,
          });
        }

        // Update the session itself
        return tx.chatSession.update({
          where: { id },
          data: updateData,
          include: {
            customers: {
              include: {
                customer: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        });
      });

      return apiSuccess({ session: updated });
    }

    // Simple update without customer changes
    const updated = await prisma.chatSession.update({
      where: { id },
      data: updateData,
      include: {
        customers: {
          include: {
            customer: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return apiSuccess({ session: updated });
  } catch (error) {
    logger.error("Failed to update chat session", error, { route: "/api/chat-sessions/[id]" });
    return errors.internal("Failed to update chat session");
  }
}

// DELETE - Delete a specific chat session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return errors.unauthorized();
    }

    const { id } = await params;

    // Ensure the session belongs to the current user
    const chatSession = await prisma.chatSession.findFirst({
      where: { id, userId },
    });

    if (!chatSession) {
      return errors.notFound("Session");
    }

    await prisma.chatSession.delete({
      where: { id },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error("Failed to delete chat session", error, { route: "/api/chat-sessions/[id]" });
    return errors.internal("Failed to delete session");
  }
}
