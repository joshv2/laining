import { VoteType } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

const voteSchema = z.object({
  type: z.nativeEnum(VoteType),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = voteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid vote type" }, { status: 400 });
  }

  const existing = await prisma.vote.findUnique({
    where: { userId_recordingId: { userId: session.user.id, recordingId: id } },
  });

  if (existing) {
    const updated = await prisma.vote.update({
      where: { id: existing.id },
      data: { type: parsed.data.type },
    });
    return Response.json({ vote: updated, updated: true });
  }

  const created = await prisma.vote.create({
    data: {
      userId: session.user.id,
      recordingId: id,
      type: parsed.data.type,
    },
  });

  return Response.json({ vote: created, updated: false }, { status: 201 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  await prisma.vote.deleteMany({
    where: { userId: session.user.id, recordingId: id },
  });

  return Response.json({ ok: true });
}
