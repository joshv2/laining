import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";
import { formatPasukRef } from "@/lib/formatters/pasuk";

import { TeacherNav } from "../../teacher-nav";

type PageProps = {
  params: Promise<{
    classId: string;
  }>;
};

function formatDate(value: Date | null): string {
  if (!value) {
    return "-";
  }

  return value.toLocaleDateString("en-US", { timeZone: "UTC" });
}

export default async function TeacherClassDetailPage({ params }: PageProps) {
  const { classId } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/teacher/classes/${classId}`)}`);
  }

  if (!isTeacher(role)) {
    redirect("/teacher");
  }

  const group = await prisma.classGroup.findFirst({
    where: {
      id: classId,
      teacherId: session.user.id,
    },
    include: {
      enrollments: {
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
      },
      assignments: {
        include: {
          recording: {
            select: {
              title: true,
              nussach: true,
              nussachCustom: true,
              primaryPasuk: {
                select: {
                  ref: true,
                },
              },
            },
          },
          playbackEvents: {
            select: {
              studentId: true,
              eventType: true,
              occurredAt: true,
            },
            orderBy: { occurredAt: "desc" },
            take: 400,
          },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 200,
      },
    },
  });

  if (!group) {
    redirect("/teacher/classes");
  }

  const totalListenEvents = group.assignments.reduce((sum, assignment) => sum + assignment.playbackEvents.length, 0);
  const activeStudents = new Set<string>();
  for (const assignment of group.assignments) {
    for (const event of assignment.playbackEvents) {
      activeStudents.add(event.studentId);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Teacher Mode</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">{group.name}</h1>
      <p className="mt-2 text-sm text-orange-900/80">Class overview, assignment metrics, and member access.</p>
      <div className="mt-4">
        <TeacherNav current="class-detail" />
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-orange-900/15 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900/70">Students</p>
          <p className="mt-2 text-2xl font-bold text-orange-950">{group.enrollments.length}</p>
        </article>
        <article className="rounded-xl border border-orange-900/15 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900/70">Students Logged In</p>
          <p className="mt-2 text-2xl font-bold text-orange-950">{activeStudents.size}</p>
        </article>
        <article className="rounded-xl border border-orange-900/15 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900/70">Listen Events</p>
          <p className="mt-2 text-2xl font-bold text-orange-950">{totalListenEvents}</p>
        </article>
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        <Link
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          href={`/teacher/create-assignment?classId=${group.id}`}
        >
          Create Assignment
        </Link>
        <Link
          className="rounded-full border border-orange-900/20 bg-white px-4 py-2 text-sm font-semibold text-orange-950 hover:bg-orange-100"
          href={`/classes/${group.id}`}
        >
          Open Member View
        </Link>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Members</h2>
          {group.enrollments.length === 0 ? (
            <p className="mt-2 text-sm text-orange-900/75">No students enrolled.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {group.enrollments.map((enrollment) => (
                <li key={enrollment.id} className="rounded-lg border border-orange-900/10 bg-white px-3 py-2 text-sm text-orange-900">
                  <Link className="font-semibold text-orange-950 hover:underline" href={`/teacher/students/${enrollment.student.id}`}>
                    {enrollment.student.name ?? enrollment.student.email ?? "Student"}
                  </Link>
                  <span className="text-xs text-orange-900/70"> - {enrollment.student.email ?? "No email"}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Assignments</h2>
          {group.assignments.length === 0 ? (
            <p className="mt-2 text-sm text-orange-900/75">No assignments yet.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-orange-900/15 text-left text-xs uppercase tracking-[0.08em] text-orange-900/70">
                    <th className="px-2 py-2">Recording</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2">Events</th>
                    <th className="px-2 py-2">Replays</th>
                  </tr>
                </thead>
                <tbody>
                  {group.assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-orange-900/10 align-top">
                      <td className="px-2 py-2 text-orange-950">
                        <span className="font-semibold">
                          {assignment.recording.title ? `${assignment.recording.title} - ` : ""}
                          {formatPasukRef(assignment.recording.primaryPasuk.ref)}
                        </span>
                        <div className="text-xs text-orange-900/70">
                          {assignment.recording.nussach}
                          {assignment.recording.nussachCustom ? ` (${assignment.recording.nussachCustom})` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-orange-900/80">{formatDate(assignment.dueAt)}</td>
                      <td className="px-2 py-2 text-orange-900/80">{assignment.playbackEvents.length}</td>
                      <td className="px-2 py-2 text-orange-900/80">
                        {assignment.playbackEvents.filter((event) => event.eventType === "PASUK_REPLAY").length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
