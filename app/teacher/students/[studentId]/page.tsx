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
    studentId: string;
  }>;
};

function formatDate(value: Date | null): string {
  if (!value) {
    return "-";
  }

  return value.toLocaleDateString("en-US", { timeZone: "UTC" });
}

export default async function TeacherStudentDetailPage({ params }: PageProps) {
  const { studentId } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/teacher/students/${studentId}`)}`);
  }

  if (!isTeacher(role)) {
    redirect("/teacher");
  }

  const relation = await prisma.teacherStudentLink.findFirst({
    where: {
      teacherId: session.user.id,
      studentId,
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!relation) {
    redirect("/teacher/students");
  }

  const [memberships, assignments] = await Promise.all([
    prisma.classEnrollment.findMany({
      where: {
        studentId,
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
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.practiceAssignment.findMany({
      where: {
        group: {
          teacherId: session.user.id,
          enrollments: {
            some: {
              studentId,
            },
          },
        },
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
          where: {
            studentId,
          },
          select: {
            eventType: true,
            occurredAt: true,
            pasuk: {
              select: {
                ref: true,
              },
            },
          },
          orderBy: { occurredAt: "desc" },
          take: 200,
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Teacher Mode</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
        {relation.student.name ?? relation.student.email ?? "Student"}
      </h1>
      <p className="mt-2 text-sm text-orange-900/80">{relation.student.email ?? "No email on account."}</p>
      <div className="mt-4">
        <TeacherNav current="student-detail" />
      </div>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Class Membership</h2>
          {memberships.length === 0 ? (
            <p className="mt-2 text-sm text-orange-900/75">No classes yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {memberships.map((membership) => (
                <li key={membership.id} className="rounded-lg border border-orange-900/10 bg-white px-3 py-2 text-sm text-orange-900">
                  <Link className="font-semibold text-orange-950 hover:underline" href={`/teacher/classes/${membership.group.id}`}>
                    {membership.group.name}
                  </Link>
                  <span className="text-xs text-orange-900/70"> - Joined {formatDate(membership.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Student Summary</h2>
          <p className="mt-2 text-sm text-orange-900/80">Assignments visible: {assignments.length}</p>
          <p className="text-sm text-orange-900/80">
            Total playback events: {assignments.reduce((sum, assignment) => sum + assignment.playbackEvents.length, 0)}
          </p>
          <p className="text-sm text-orange-900/80">
            Replay events: {assignments.reduce((sum, assignment) => sum + assignment.playbackEvents.filter((event) => event.eventType === "PASUK_REPLAY").length, 0)}
          </p>
        </article>
      </section>

      <section className="mt-4 rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <h2 className="text-lg font-bold text-orange-950">Assignments and Progress</h2>
        {assignments.length === 0 ? (
          <p className="mt-2 text-sm text-orange-900/75">No assignments found for this student.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-orange-900/15 text-left text-xs uppercase tracking-[0.08em] text-orange-900/70">
                  <th className="px-2 py-2">Recording</th>
                  <th className="px-2 py-2">Class</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2">Events</th>
                  <th className="px-2 py-2">Replays</th>
                  <th className="px-2 py-2">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const events = assignment.playbackEvents.length;
                  const replayEvents = assignment.playbackEvents.filter((event) => event.eventType === "PASUK_REPLAY").length;
                  const lastActivity = assignment.playbackEvents[0]?.occurredAt ?? null;

                  return (
                    <tr key={assignment.id} className="border-b border-orange-900/10 align-top">
                      <td className="px-2 py-2 text-orange-950">
                        <span className="font-semibold">{assignment.recording.title ? `${assignment.recording.title} - ` : ""}{formatPasukRef(assignment.recording.primaryPasuk.ref)}</span>
                        <div className="text-xs text-orange-900/70">
                          {assignment.recording.nussach}
                          {assignment.recording.nussachCustom ? ` (${assignment.recording.nussachCustom})` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-orange-900/80">{assignment.group.name}</td>
                      <td className="px-2 py-2 text-orange-900/80">{formatDate(assignment.dueAt)}</td>
                      <td className="px-2 py-2 text-orange-900/80">{events}</td>
                      <td className="px-2 py-2 text-orange-900/80">{replayEvents}</td>
                      <td className="px-2 py-2 text-orange-900/80">{formatDate(lastActivity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
