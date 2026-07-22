import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

import { TeacherNav } from "../teacher-nav";

export default async function TeacherClassesPage() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect("/signin?callbackUrl=/teacher/classes");
  }

  if (!isTeacher(role)) {
    redirect("/teacher");
  }

  const groups = await prisma.classGroup.findMany({
    where: {
      teacherId: session.user.id,
      name: {
        not: {
          startsWith: "Direct 1-on-1:",
        },
      },
    },
    include: {
      _count: {
        select: {
          enrollments: true,
          assignments: true,
        },
      },
      assignments: {
        select: {
          id: true,
          playbackEvents: {
            select: {
              studentId: true,
            },
          },
        },
        take: 200,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Teacher Mode</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Classes</h1>
      <p className="mt-2 text-sm text-orange-900/80">Open a class to see members, metrics, and assignment actions.</p>
      <div className="mt-4">
        <TeacherNav current="classes" />
      </div>

      <section className="mt-4 rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        {groups.length === 0 ? (
          <p className="text-sm text-orange-900/75">No classes yet. Build one from the Students page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-orange-900/15 text-left text-xs uppercase tracking-[0.08em] text-orange-900/70">
                  <th className="px-2 py-2">Class</th>
                  <th className="px-2 py-2">Students</th>
                  <th className="px-2 py-2">Assignments</th>
                  <th className="px-2 py-2">Students Logged In</th>
                  <th className="px-2 py-2">Total Listen Events</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  let listenEvents = 0;
                  const activeStudents = new Set<string>();

                  for (const assignment of group.assignments) {
                    listenEvents += assignment.playbackEvents.length;
                    for (const event of assignment.playbackEvents) {
                      activeStudents.add(event.studentId);
                    }
                  }

                  return (
                    <tr key={group.id} className="border-b border-orange-900/10 align-top">
                      <td className="px-2 py-2 font-semibold text-orange-950">
                        <Link className="hover:underline" href={`/teacher/classes/${group.id}`}>
                          {group.name}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-orange-900/80">{group._count.enrollments}</td>
                      <td className="px-2 py-2 text-orange-900/80">{group._count.assignments}</td>
                      <td className="px-2 py-2 text-orange-900/80">{activeStudents.size}</td>
                      <td className="px-2 py-2 text-orange-900/80">{listenEvents}</td>
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
