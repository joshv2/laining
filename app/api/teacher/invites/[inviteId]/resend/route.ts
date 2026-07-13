import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

type RouteContext = {
  params: Promise<{
    inviteId: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTeacher(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { inviteId } = await context.params;
  const invite = await prisma.teacherInvite.findFirst({
    where: {
      id: inviteId,
      teacherId: session.user.id,
    },
    select: {
      id: true,
      acceptedAt: true,
      expiresAt: true,
    },
  });

  if (!invite) {
    return Response.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.acceptedAt) {
    return Response.json({ error: "Accepted invites cannot be resent." }, { status: 409 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const updatedInvite = await prisma.teacherInvite.update({
    where: { id: invite.id },
    data: {
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

  return Response.json({ invite: updatedInvite });
}
