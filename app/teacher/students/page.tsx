import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

import { TeacherNav } from "../teacher-nav";
import { StudentsPageClient } from "./students-page-client";

export default async function TeacherStudentsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect("/signin?callbackUrl=/teacher/students");
  }

  if (!isTeacher(role)) {
    redirect("/teacher");
  }

  const [directLinks, classes] = await Promise.all([
    prisma.teacherStudentLink.findMany({
      where: { teacherId: session.user.id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    prisma.classGroup.findMany({
      where: {
        teacherId: session.user.id,
        name: {
          not: {
            startsWith: "Direct 1-on-1:",
          },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
      },
      take: 120,
    }),
  ]);

  const studentIds = directLinks.map((item) => item.student.id);

  const [enrollments, latestEvents] = studentIds.length
    ? await Promise.all([
        prisma.classEnrollment.findMany({
          where: {
            studentId: { in: studentIds },
            group: {
              teacherId: session.user.id,
            },
          },
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          take: 2000,
        }),
        prisma.playbackEvent.findMany({
          where: {
            teacherId: session.user.id,
            studentId: { in: studentIds },
          },
          orderBy: { occurredAt: "desc" },
          select: {
            studentId: true,
            occurredAt: true,
          },
          take: 4000,
        }),
      ])
    : [[], []];

  const classesByStudent = new Map<string, { id: string; name: string }[]>();
  for (const enrollment of enrollments) {
    const list = classesByStudent.get(enrollment.studentId) ?? [];
    if (!list.some((group) => group.id === enrollment.group.id)) {
      list.push({ id: enrollment.group.id, name: enrollment.group.name });
    }
    classesByStudent.set(enrollment.studentId, list);
  }

  const latestByStudent = new Map<string, string>();
  for (const event of latestEvents) {
    if (!latestByStudent.has(event.studentId)) {
      latestByStudent.set(event.studentId, event.occurredAt.toISOString());
    }
  }

  const students = directLinks.map((link) => ({
    id: link.student.id,
    name: link.student.name,
    email: link.student.email,
    classes: classesByStudent.get(link.student.id) ?? [],
    lastActivityAt: latestByStudent.get(link.student.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Teacher Mode</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Students</h1>
      <p className="mt-2 text-sm text-orange-900/80">Manage direct students, build classes, and open individual progress pages.</p>
      <div className="mt-4">
        <TeacherNav current="students" />
      </div>
      <StudentsPageClient
        classes={classes.map((group) => ({ id: group.id, name: group.name }))}
        students={students}
      />
    </main>
  );
}
