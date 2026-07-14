import { Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

const createInviteSchema = z.object({
  groupId: z.string().min(1).optional(),
  email: z.string().email(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
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

  const invites = await prisma.teacherInvite.findMany({
    where: {
      teacherId: session.user.id,
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
      acceptedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    take: 200,
  });

  return Response.json({ invites });
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

  const parsed = createInviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  let groupId: string | null = null;
  if (parsed.data.groupId) {
    const group = await prisma.classGroup.findFirst({
      where: {
        id: parsed.data.groupId,
        teacherId: session.user.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!group) {
      return Response.json({ error: "Class not found" }, { status: 404 });
    }

    groupId = group.id;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (parsed.data.expiresInDays ?? 7));

  const invite = await prisma.teacherInvite.create({
    data: {
      teacherId: session.user.id,
      groupId,
      email: normalizedEmail,
      token: crypto.randomUUID(),
      expiresAt,
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return Response.json({
    invite: {
      ...invite,
      kind: invite.groupId ? "class" : "direct",
    },
  }, { status: 201 });
}
