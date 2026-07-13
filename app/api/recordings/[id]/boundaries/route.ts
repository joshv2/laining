import { Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

const boundarySchema = z.object({
  pasukId: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

const boundaryListSchema = z.object({
  boundaries: z.array(boundarySchema).min(1),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = boundaryListSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid boundaries", details: parsed.error.flatten() }, { status: 400 });
  }

  const recording = await prisma.recording.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!recording) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = recording.userId === session.user.id;
  const isModerator = session.user.role === Role.MODERATOR || session.user.role === Role.SUPERUSER;
  if (!isOwner && !isModerator) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const invalid = parsed.data.boundaries.find((item) => item.startMs >= item.endMs);
  if (invalid) {
    return Response.json({ error: "Boundary start must be before end" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.pasukBoundary.deleteMany({ where: { recordingId: id } }),
    prisma.pasukBoundary.createMany({
      data: parsed.data.boundaries.map((item) => ({
        recordingId: id,
        pasukId: item.pasukId,
        startMs: item.startMs,
        endMs: item.endMs,
        confidence: item.confidence,
      })),
    }),
  ]);

  return Response.json({ ok: true });
}
