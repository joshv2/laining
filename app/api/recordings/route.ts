import { RecordingStatus, Role, TokenizationEventType } from "@prisma/client";
import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { runAlignmentForRecording } from "@/app/api/recordings/[id]/alignment/route";
import { isModeratorOrAbove } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";
import { createRecordingSchema, normalizeNussach } from "@/lib/services/recording-ingestion";
import { triggerTokenizationSafely } from "@/lib/services/tokenization";

export async function GET(request: NextRequest) {
  const session = await auth();
  const searchParams = request.nextUrl.searchParams;
  const pasukId = searchParams.get("pasukId") || undefined;
  const role = (session?.user?.role ?? Role.USER) as Role;
  const canUseAssignedMode = role === Role.USER || role === Role.SUPERUSER;

  const canSeeUnapproved = session?.user?.role ? isModeratorOrAbove(session.user.role) : false;
  const statusFilter = canSeeUnapproved ? undefined : RecordingStatus.APPROVED;

  let assignedRecordingIds: string[] = [];
  let accessMode: "assigned-only" | "public-catalog" = "public-catalog";

  if (pasukId && session?.user?.id && canUseAssignedMode) {
    const assignedRecordings = await prisma.practiceAssignment.findMany({
      where: {
        group: {
          enrollments: {
            some: {
              studentId: session.user.id,
            },
          },
        },
        recording: {
          OR: [{ primaryPasukId: pasukId }, { boundaries: { some: { pasukId } } }],
        },
      },
      select: {
        recordingId: true,
        group: {
          select: {
            teacherId: true,
          },
        },
        recording: {
          select: {
            status: true,
            userId: true,
          },
        },
      },
      take: 300,
    });

    assignedRecordingIds = Array.from(
      new Set(
        assignedRecordings
          .filter((assignment) => assignment.recording.status === RecordingStatus.APPROVED || assignment.recording.userId === assignment.group.teacherId)
          .map((assignment) => assignment.recordingId),
      ),
    );

    if (assignedRecordingIds.length > 0) {
      accessMode = "assigned-only";
    }
  }

  const isAssignedModeForAssignedUser = canUseAssignedMode && accessMode === "assigned-only";
  const where = pasukId
    ? {
        ...(isAssignedModeForAssignedUser ? {} : { status: statusFilter }),
        ...(assignedRecordingIds.length > 0 ? { id: { in: assignedRecordingIds } } : {}),
        OR: [
          { primaryPasukId: pasukId },
          {
            boundaries: {
              some: {
                pasukId,
              },
            },
          },
        ],
      }
    : {
        status: statusFilter,
      };

  const recordings = await prisma.recording.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { votes: true } },
      boundaries: {
        orderBy: { startMs: "asc" },
        select: {
          pasukId: true,
          startMs: true,
          endMs: true,
          pasuk: {
            select: {
              ref: true,
              number: true,
              hebrewText: true,
              englishText: true,
            },
          },
        },
      },
    },
    take: 100,
  });

  const rankedRecordings = pasukId
    ? [...recordings].sort((a, b) => {
        const aPrimary = a.primaryPasukId === pasukId ? 1 : 0;
        const bPrimary = b.primaryPasukId === pasukId ? 1 : 0;
        if (aPrimary !== bPrimary) {
          return bPrimary - aPrimary;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
    : recordings;

  const responseRecordings = rankedRecordings.map((recording) => {
    const boundaryMatches = pasukId
      ? recording.boundaries.filter((item) => item.pasukId === pasukId).length
      : 0;

    return {
      ...recording,
      matchType:
        pasukId && recording.primaryPasukId === pasukId
          ? "primary"
          : pasukId && boundaryMatches > 0
            ? "boundary"
            : "none",
    };
  });

  return Response.json({ recordings: responseRecordings, accessMode });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createRecordingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const isTeacherSubmission = session.user.role === Role.TEACHER;
  const normalized = normalizeNussach(parsed.data);
  const normalizedTitle = parsed.data.title?.trim() || undefined;
  const recording = await prisma.recording.create({
    data: {
      ...parsed.data,
      title: normalizedTitle,
      nussach: normalized.nussach,
      nussachCustom: normalized.nussachCustom,
      userId: session.user.id,
      status: RecordingStatus.PENDING_APPROVAL,
    },
  });

  if (isTeacherSubmission) {
    await triggerTokenizationSafely({
      eventType: TokenizationEventType.MODERATION_APPROVED,
      recipientUserId: recording.userId,
      sourceType: "recording",
      sourceId: recording.id,
      metadata: {
        reason: "teacher-submit",
      },
    });

    void runAlignmentForRecording(recording.id).catch((error) => {
      console.error("Failed to run alignment after teacher submission:", error);
    });
  }

  return Response.json(
    {
      recording,
      tokenizationQueued: isTeacherSubmission,
      alignmentQueued: isTeacherSubmission,
    },
    { status: 201 },
  );
}
