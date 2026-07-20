import { RecordingStatus, Role, TokenizationEventType } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { runAlignmentForRecording } from "@/app/api/recordings/[id]/alignment/route";
import { triggerTokenizationSafely } from "@/lib/services/tokenization";

const decisionSchema = z.object({
  recordingId: z.string().min(1),
  nextStatus: z.enum([RecordingStatus.APPROVED, RecordingStatus.REJECTED]),
  reason: z.string().max(500).optional(),
});

function canModerate(role: Role): boolean {
  return role === Role.MODERATOR || role === Role.SUPERUSER;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !canModerate(session.user.role ?? Role.USER)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const queue = await prisma.recording.findMany({
    where: { status: RecordingStatus.PENDING_APPROVAL },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true } },
      primaryPasuk: { select: { id: true, ref: true } },
    },
    take: 100,
  });

  return Response.json({ queue });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !canModerate(session.user.role ?? Role.USER)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { recordingId, nextStatus, reason } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const recording = await tx.recording.update({
      where: { id: recordingId },
      data: {
        status: nextStatus,
        moderationNotes: reason,
        approvedAt: nextStatus === RecordingStatus.APPROVED ? new Date() : null,
        approvedByUserId: nextStatus === RecordingStatus.APPROVED ? session.user.id : null,
      },
    });

    await tx.moderationDecision.create({
      data: {
        recordingId,
        moderatorId: session.user.id,
        nextStatus,
        reason,
      },
    });

    return recording;
  });

  await triggerTokenizationSafely({
    eventType:
      nextStatus === RecordingStatus.APPROVED
        ? TokenizationEventType.MODERATION_APPROVED
        : TokenizationEventType.MODERATION_REJECTED,
    recipientUserId: updated.userId,
    sourceType: "recording",
    sourceId: updated.id,
    metadata: {
      moderatorId: session.user.id,
      nextStatus,
      reason: reason ?? null,
    },
  });

  if (nextStatus === RecordingStatus.APPROVED) {
    try {
      await runAlignmentForRecording(updated.id);
    } catch (error) {
      console.error("Failed to run alignment after approval:", error);
    }
  }

  return Response.json({ recording: updated });
}
