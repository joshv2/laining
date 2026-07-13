import { Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

const updateAssignmentSchema = z.object({
  instructions: z.string().max(2000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTeacher(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { assignmentId } = await context.params;
  const parsed = updateAssignmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const assignment = await prisma.practiceAssignment.findFirst({
    where: {
      id: assignmentId,
      assignedByTeacherId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!assignment) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : parsed.data.dueAt === null ? null : undefined;
  if (dueAt instanceof Date && Number.isNaN(dueAt.getTime())) {
    return Response.json({ error: "Invalid dueAt date" }, { status: 400 });
  }

  const updated = await prisma.practiceAssignment.update({
    where: { id: assignment.id },
    data: {
      ...(parsed.data.instructions !== undefined ? { instructions: parsed.data.instructions } : {}),
      ...(parsed.data.dueAt !== undefined ? { dueAt } : {}),
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
          primaryPasuk: {
            select: {
              ref: true,
            },
          },
        },
      },
    },
  });

  return Response.json({ assignment: updated });
}

export async function DELETE(_: Request, context: RouteContext) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTeacher(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { assignmentId } = await context.params;
  const assignment = await prisma.practiceAssignment.findFirst({
    where: {
      id: assignmentId,
      assignedByTeacherId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!assignment) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }

  await prisma.practiceAssignment.delete({
    where: { id: assignment.id },
  });

  return Response.json({ ok: true });
}
