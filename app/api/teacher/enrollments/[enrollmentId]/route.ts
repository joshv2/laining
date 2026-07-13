import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

type RouteContext = {
  params: Promise<{
    enrollmentId: string;
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

  const { enrollmentId } = await context.params;
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      id: enrollmentId,
      group: {
        teacherId: session.user.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!enrollment) {
    return Response.json({ error: "Enrollment not found" }, { status: 404 });
  }

  await prisma.classEnrollment.delete({
    where: { id: enrollment.id },
  });

  return Response.json({ ok: true });
}
