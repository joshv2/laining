import { Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

const payloadSchema = z.object({
  groupId: z.string().min(1).optional(),
  className: z.string().min(2).max(80).optional(),
  studentIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTeacher(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.groupId && !parsed.data.className) {
    return Response.json({ error: "Provide groupId or className" }, { status: 400 });
  }

  const uniqueStudentIds = Array.from(new Set(parsed.data.studentIds));

  const directLinks = await prisma.teacherStudentLink.findMany({
    where: {
      teacherId: session.user.id,
      studentId: { in: uniqueStudentIds },
    },
    select: {
      studentId: true,
    },
  });

  const allowedStudentIds = new Set(directLinks.map((item) => item.studentId));
  const blockedStudentIds = uniqueStudentIds.filter((studentId) => !allowedStudentIds.has(studentId));

  if (blockedStudentIds.length > 0) {
    return Response.json({ error: "One or more selected students are not direct students of this teacher." }, { status: 403 });
  }

  const group = parsed.data.groupId
    ? await prisma.classGroup.findFirst({
        where: {
          id: parsed.data.groupId,
          teacherId: session.user.id,
        },
        select: {
          id: true,
          name: true,
        },
      })
    : await prisma.classGroup.create({
        data: {
          teacherId: session.user.id,
          name: parsed.data.className!.trim(),
        },
        select: {
          id: true,
          name: true,
        },
      });

  if (!group) {
    return Response.json({ error: "Class not found" }, { status: 404 });
  }

  const existing = await prisma.classEnrollment.findMany({
    where: {
      groupId: group.id,
      studentId: { in: uniqueStudentIds },
    },
    select: {
      studentId: true,
    },
  });

  const existingIds = new Set(existing.map((item) => item.studentId));
  const toInsert = uniqueStudentIds.filter((studentId) => !existingIds.has(studentId));

  if (toInsert.length > 0) {
    await prisma.classEnrollment.createMany({
      data: toInsert.map((studentId) => ({
        groupId: group.id,
        studentId,
      })),
      skipDuplicates: true,
    });
  }

  return Response.json({
    ok: true,
    group,
    summary: {
      selected: uniqueStudentIds.length,
      createdEnrollments: toInsert.length,
      alreadyEnrolled: uniqueStudentIds.length - toInsert.length,
    },
  });
}
