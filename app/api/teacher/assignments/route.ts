import { RecordingStatus, Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

const createAssignmentSchema = z.object({
  groupId: z.string().min(1),
  recordingId: z.string().min(1),
  instructions: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTeacher(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId") ?? undefined;

  const assignments = await prisma.practiceAssignment.findMany({
    where: {
      assignedByTeacherId: session.user.id,
      ...(groupId ? { groupId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
      recording: {
        select: {
          id: true,
          nussach: true,
          nussachCustom: true,
          publicUrl: true,
          durationMs: true,
          primaryPasuk: {
            select: {
              id: true,
              ref: true,
            },
          },
        },
      },
      _count: {
        select: {
          playbackEvents: true,
        },
      },
    },
    take: 200,
  });

  return Response.json({ assignments });
}

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTeacher(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createAssignmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return Response.json({ error: "Invalid dueAt date" }, { status: 400 });
  }

  const group = await prisma.classGroup.findFirst({
    where: {
      id: parsed.data.groupId,
      teacherId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!group) {
    return Response.json({ error: "Class not found" }, { status: 404 });
  }

  const recording = await prisma.recording.findFirst({
    where: {
      id: parsed.data.recordingId,
      status: RecordingStatus.APPROVED,
    },
    select: {
      id: true,
    },
  });

  if (!recording) {
    return Response.json({ error: "Recording not found or not approved" }, { status: 404 });
  }

  const existingAssignment = await prisma.practiceAssignment.findFirst({
    where: {
      groupId: group.id,
      recordingId: recording.id,
    },
    select: {
      id: true,
    },
  });

  if (existingAssignment) {
    return Response.json({ error: "Recording is already assigned to this class" }, { status: 409 });
  }

  const assignment = await prisma.practiceAssignment.create({
    data: {
      groupId: group.id,
      recordingId: recording.id,
      assignedByTeacherId: session.user.id,
      instructions: parsed.data.instructions,
      dueAt,
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
      recording: {
        select: {
          id: true,
          nussach: true,
          nussachCustom: true,
          publicUrl: true,
          durationMs: true,
          primaryPasuk: {
            select: {
              id: true,
              ref: true,
            },
          },
        },
      },
    },
  });

  return Response.json({ assignment }, { status: 201 });
}
