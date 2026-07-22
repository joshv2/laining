import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";
import { formatPasukRef } from "@/lib/formatters/pasuk";

import { ActivateTeacherButton } from "./activate-teacher-button";
import { TeacherDashboardClient } from "./teacher-dashboard-client";
import { TeacherNav } from "./teacher-nav";

function isDirectClassName(name: string): boolean {
  return name.startsWith("Direct 1-on-1:");
}

export default async function TeacherPage() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect("/signin?callbackUrl=/teacher");
  }

  if (!isTeacher(role)) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12">
        <div className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-6 shadow-[0_16px_38px_rgba(88,31,13,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Teacher Mode</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Set Up Your Teacher Account</h1>
          <p className="mt-3 max-w-2xl text-sm text-orange-900/80">
            Teacher mode lets you invite students by email, assign specific recordings, and track login and practice activity.
          </p>
          <p className="mt-2 max-w-2xl text-xs font-semibold text-orange-900/70">
            Recording playback remains open; only teacher feature access can be coupon or payment gated.
          </p>
          <div className="mt-5">{role === Role.USER ? <ActivateTeacherButton /> : null}</div>
          {role !== Role.USER ? (
            <p className="mt-3 text-xs font-semibold text-orange-900/70">
              Current role: {role}. Self-activation is available for standard user accounts only.
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [
    groupsRaw,
    directLinksRaw,
    assignmentsRaw,
    teacherPlaybackEventsRaw,
    teacherAccessSubscriptionRaw,
    pendingInvites,
    totalAssignments,
    enrollmentsRaw,
  ] = await Promise.all([
    prisma.classGroup.findMany({
      where: { teacherId: session.user.id },
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
        },
      },
      orderBy: { createdAt: "desc" },
      take: 180,
    }),
    prisma.teacherStudentLink.findMany({
      where: {
        teacherId: session.user.id,
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
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.practiceAssignment.findMany({
      where: { assignedByTeacherId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        group: {
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
            },
          },
        },
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
      take: 200,
    }),
    prisma.playbackEvent.findMany({
      where: {
        teacherId: session.user.id,
        occurredAt: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: { occurredAt: "desc" },
      select: {
        studentId: true,
        occurredAt: true,
      },
      take: 2000,
    }),
    prisma.teacherAccessSubscription?.findUnique({
      where: {
        userId: session.user.id,
      },
      select: {
        status: true,
        source: true,
        priceCents: true,
        currencyCode: true,
        activatedAt: true,
        deactivatedAt: true,
      },
    }) ?? Promise.resolve(null),
    prisma.teacherInvite.count({
      where: {
        teacherId: session.user.id,
        acceptedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    }),
    prisma.practiceAssignment.count({
      where: {
        assignedByTeacherId: session.user.id,
      },
    }),
    prisma.classEnrollment.findMany({
      where: {
        group: {
          teacherId: session.user.id,
        },
      },
      select: {
        studentId: true,
      },
      take: 2000,
    }),
  ]);

  const assignmentIds = assignmentsRaw.map((assignment) => assignment.id);
  const assignmentEventsRaw = assignmentIds.length
    ? await prisma.playbackEvent.findMany({
        where: {
          assignmentId: {
            in: assignmentIds,
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
        select: {
          assignmentId: true,
          studentId: true,
          eventType: true,
          occurredAt: true,
          pasuk: {
            select: {
              ref: true,
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        take: 6000,
      })
    : [];

  const uniqueStudentIds = new Set<string>();
  for (const link of directLinksRaw) {
    uniqueStudentIds.add(link.student.id);
  }
  for (const enrollment of enrollmentsRaw) {
    uniqueStudentIds.add(enrollment.studentId);
  }

  const latestTeacherActivity = new Map<string, Date>();
  for (const event of teacherPlaybackEventsRaw) {
    if (!latestTeacherActivity.has(event.studentId)) {
      latestTeacherActivity.set(event.studentId, event.occurredAt);
    }
  }

  const assignmentActivityBuckets = new Map<
    string,
    Map<
      string,
      {
        studentId: string;
        studentName: string | null;
        studentEmail: string | null;
        totalEvents: number;
        replayEvents: number;
        lastOccurredAt: Date;
        replayByPasuk: Map<string, number>;
      }
    >
  >();

  for (const event of assignmentEventsRaw) {
    if (!event.assignmentId) {
      continue;
    }

    const assignmentBucket = assignmentActivityBuckets.get(event.assignmentId) ?? new Map();
    const studentBucket =
      assignmentBucket.get(event.studentId) ??
      {
        studentId: event.studentId,
        studentName: event.student.name,
        studentEmail: event.student.email,
        totalEvents: 0,
        replayEvents: 0,
        lastOccurredAt: event.occurredAt,
        replayByPasuk: new Map<string, number>(),
      };

    studentBucket.totalEvents += 1;
    if (event.eventType === "PASUK_REPLAY") {
      studentBucket.replayEvents += 1;
      if (event.pasuk?.ref) {
        studentBucket.replayByPasuk.set(event.pasuk.ref, (studentBucket.replayByPasuk.get(event.pasuk.ref) ?? 0) + 1);
      }
    }

    if (studentBucket.lastOccurredAt.getTime() < event.occurredAt.getTime()) {
      studentBucket.lastOccurredAt = event.occurredAt;
    }

    assignmentBucket.set(event.studentId, studentBucket);
    assignmentActivityBuckets.set(event.assignmentId, assignmentBucket);
  }

  const directAssignments: {
    assignmentId: string;
    classId: string;
    studentId: string;
    studentName: string | null;
    studentEmail: string | null;
    className: string;
    recordingLabel: string;
    dueAt: string | null;
    instructions: string | null;
    totalEvents: number;
    replayEvents: number;
    lastOccurredAt: string | null;
    topReplayPasukRef: string | null;
    topReplayCount: number;
    isOld: boolean;
  }[] = [];

  const classAssignments: {
    assignmentId: string;
    classId: string;
    className: string;
    recordingLabel: string;
    dueAt: string | null;
    instructions: string | null;
    totalStudents: number;
    studentsWithActivity: number;
    totalEvents: number;
    replayEvents: number;
    lastOccurredAt: string | null;
    isOld: boolean;
  }[] = [];

  for (const assignment of assignmentsRaw) {
    const dueAtIso = assignment.dueAt ? assignment.dueAt.toISOString() : null;
    const isOld = Boolean(assignment.dueAt && assignment.dueAt.getTime() < now.getTime());
    const recordingLabel = `${assignment.recording.title ? `${assignment.recording.title} - ` : ""}${formatPasukRef(assignment.recording.primaryPasuk.ref)} - ${assignment.recording.nussach}${assignment.recording.nussachCustom ? ` (${assignment.recording.nussachCustom})` : ""}`;

    const studentActivityRows = Array.from(assignmentActivityBuckets.get(assignment.id)?.values() ?? []);

    if (isDirectClassName(assignment.group.name)) {
      const enrolledStudent = assignment.group.enrollments[0]?.student;
      const directStudent = enrolledStudent ?? directLinksRaw.find((link) => link.student.id === assignment.group.name.replace("Direct 1-on-1: ", ""))?.student ?? null;
      const activityForStudent = directStudent ? studentActivityRows.find((row) => row.studentId === directStudent.id) : studentActivityRows[0] ?? null;

      let topReplayPasukRef: string | null = null;
      let topReplayCount = 0;

      if (activityForStudent) {
        for (const [pasukRef, count] of activityForStudent.replayByPasuk.entries()) {
          if (count > topReplayCount) {
            topReplayCount = count;
            topReplayPasukRef = formatPasukRef(pasukRef);
          }
        }
      }

      directAssignments.push({
        assignmentId: assignment.id,
        classId: assignment.group.id,
        studentId: directStudent?.id ?? activityForStudent?.studentId ?? "unknown",
        studentName: directStudent?.name ?? activityForStudent?.studentName ?? null,
        studentEmail: directStudent?.email ?? activityForStudent?.studentEmail ?? null,
        className: assignment.group.name,
        recordingLabel,
        dueAt: dueAtIso,
        instructions: assignment.instructions,
        totalEvents: activityForStudent?.totalEvents ?? 0,
        replayEvents: activityForStudent?.replayEvents ?? 0,
        lastOccurredAt: activityForStudent?.lastOccurredAt.toISOString() ?? null,
        topReplayPasukRef,
        topReplayCount,
        isOld,
      });

      continue;
    }

    let totalEvents = 0;
    let replayEvents = 0;
    let lastOccurredAt: Date | null = null;
    const studentsWithActivity = new Set<string>();

    for (const row of studentActivityRows) {
      totalEvents += row.totalEvents;
      replayEvents += row.replayEvents;
      studentsWithActivity.add(row.studentId);
      if (!lastOccurredAt || row.lastOccurredAt.getTime() > lastOccurredAt.getTime()) {
        lastOccurredAt = row.lastOccurredAt;
      }
    }

    classAssignments.push({
      assignmentId: assignment.id,
      classId: assignment.group.id,
      className: assignment.group.name,
      recordingLabel,
      dueAt: dueAtIso,
      instructions: assignment.instructions,
      totalStudents: assignment.group.enrollments.length,
      studentsWithActivity: studentsWithActivity.size,
      totalEvents,
      replayEvents,
      lastOccurredAt: lastOccurredAt?.toISOString() ?? null,
      isOld,
    });
  }

  const hasNamedClasses = groupsRaw.some((group) => !isDirectClassName(group.name));

  const teacherAccess = {
    status: teacherAccessSubscriptionRaw?.status ?? "ACTIVE",
    source: teacherAccessSubscriptionRaw?.source ?? "FREE",
    priceCents: teacherAccessSubscriptionRaw?.priceCents ?? 0,
    currencyCode: teacherAccessSubscriptionRaw?.currencyCode ?? "USD",
    activatedAt: teacherAccessSubscriptionRaw?.activatedAt.toISOString() ?? null,
    deactivatedAt: teacherAccessSubscriptionRaw?.deactivatedAt?.toISOString() ?? null,
  };

  const analytics = {
    totalStudents: uniqueStudentIds.size,
    pendingInvites,
    totalAssignments,
    weeklyAssignmentEvents: teacherPlaybackEventsRaw.length,
    weeklyActiveStudents: latestTeacherActivity.size,
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <header className="mb-6">
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] md:text-4xl">Teacher Dashboard</h1>
        <div className="mt-4">
          <TeacherNav current="dashboard" />
        </div>
      </header>

      <TeacherDashboardClient
        analytics={analytics}
        classAssignments={classAssignments}
        directAssignments={directAssignments}
        hasClasses={hasNamedClasses}
        teacherAccess={teacherAccess}
      />
    </main>
  );
}
