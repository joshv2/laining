import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

type RouteContext = {
  params: Promise<{
    inviteId: string;
  }>;
};

export async function DELETE(_: Request, context: RouteContext) {
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
    },
  });

  if (!invite) {
    return Response.json({ error: "Invite not found" }, { status: 404 });
  }

  await prisma.teacherInvite.delete({
    where: { id: invite.id },
  });

  return Response.json({ ok: true });
}
