import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

const playbackEventSchema = z.object({
  recordingId: z.string().min(1),
  eventType: z.enum(["PLAY", "PAUSE", "ENDED", "PASUK_REPLAY"]),
  pasukId: z.string().min(1).optional(),
  positionMs: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = playbackEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const assignment = await prisma.practiceAssignment.findFirst({
    where: {
      recordingId: parsed.data.recordingId,
      group: {
        enrollments: {
          some: {
            studentId: session.user.id,
          },
        },
      },
    },
    orderBy: [
      {
        dueAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      id: true,
      assignedByTeacherId: true,
    },
  });

  const directLink = assignment
    ? null
    : await prisma.teacherStudentLink.findFirst({
        where: {
          studentId: session.user.id,
        },
        orderBy: { createdAt: "desc" },
        select: {
          teacherId: true,
        },
      });

  await prisma.playbackEvent.create({
    data: {
      studentId: session.user.id,
      teacherId: assignment?.assignedByTeacherId ?? directLink?.teacherId ?? null,
      recordingId: parsed.data.recordingId,
      assignmentId: assignment?.id,
      pasukId: parsed.data.pasukId,
      eventType: parsed.data.eventType,
      positionMs: parsed.data.positionMs,
      durationMs: parsed.data.durationMs,
    },
  });

  return Response.json({ ok: true, assignmentScoped: Boolean(assignment?.id) });
}
