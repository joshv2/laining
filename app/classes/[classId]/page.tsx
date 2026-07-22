import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { formatPasukRef } from "@/lib/formatters/pasuk";

const TEACHER_ROLE: Role = Role.TEACHER;

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

export default async function ClassMemberPage({ params }: PageProps) {
  const { classId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/classes/${classId}`)}`);
  }

  const group = await prisma.classGroup.findUnique({
    where: { id: classId },
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      enrollments: {
        where: {
          studentId: session.user.id,
        },
        select: {
          id: true,
        },
      },
      assignments: {
        include: {
          recording: {
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
          },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 250,
      },
    },
  });

  if (!group) {
    redirect("/learn");
  }

  const isTeacherOwner = session.user.id === group.teacherId && session.user.role === TEACHER_ROLE;
  const isMember = group.enrollments.length > 0;

  if (!isTeacherOwner && !isMember) {
    redirect("/learn");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Class</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">{group.name}</h1>
      <p className="mt-2 text-sm text-orange-900/80">Teacher: {group.teacher.name ?? group.teacher.email ?? "Unknown"}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="rounded-full border border-orange-900/20 bg-white px-4 py-2 text-sm font-semibold text-orange-950 hover:bg-orange-100" href="/learn">
          Back to Learn
        </Link>
        {isTeacherOwner ? (
          <Link className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]" href={`/teacher/classes/${group.id}`}>
            Open Teacher Class Page
          </Link>
        ) : null}
      </div>

      <section className="mt-4 rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <h2 className="text-lg font-bold text-orange-950">Assignments</h2>
        {group.assignments.length === 0 ? (
          <p className="mt-2 text-sm text-orange-900/75">No class assignments yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-orange-900/15 text-left text-xs uppercase tracking-[0.08em] text-orange-900/70">
                  <th className="px-2 py-2">Recording</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2">Instructions</th>
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
                    <td className="px-2 py-2 text-orange-900/80">{assignment.instructions ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
