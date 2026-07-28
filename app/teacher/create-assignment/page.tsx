import { RecordingStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";
import { formatPasukRef } from "@/lib/formatters/pasuk";

import { TeacherNav } from "../teacher-nav";
import { CreateAssignmentForm } from "./create-assignment-form";

export default async function CreateAssignmentPage() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect("/signin?callbackUrl=/teacher/create-assignment");
  }

  if (!isTeacher(role)) {
    redirect("/teacher");
  }

  const [directLinks, groupsRaw, recordingsRaw] = await Promise.all([
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
      take: 300,
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
      take: 100,
    }),
    prisma.recording.findMany({
      where: {
        OR: [{ status: RecordingStatus.APPROVED }, { userId: session.user.id }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        nussach: true,
        nussachCustom: true,
        primaryPasuk: {
          select: {
            ref: true,
          },
        },
      },
      take: 250,
    }),
  ]);

  const students = directLinks.map((link) => ({
    id: link.student.id,
    label: `${link.student.name ?? "Student"} (${link.student.email ?? "No email"})`,
  }));

  const classes = groupsRaw.map((group) => ({
    id: group.id,
    name: group.name,
  }));

  const recordings = recordingsRaw.map((recording) => ({
    id: recording.id,
    label: `${recording.title ? `${recording.title} - ` : ""}${formatPasukRef(recording.primaryPasuk.ref)} - ${recording.nussach}${recording.nussachCustom ? ` (${recording.nussachCustom})` : ""}`,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Teacher Mode</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Create Assignment</h1>
      <p className="mt-2 text-sm text-orange-900/80">Choose from your students first. Class assignment remains available from this page and class pages.</p>
      <div className="mt-4">
        <TeacherNav current="create-assignment" />
      </div>
      <CreateAssignmentForm classes={classes} recordings={recordings} students={students} />
    </main>
  );
}
