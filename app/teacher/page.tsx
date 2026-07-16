import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RecordingStatus, Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

import { ActivateTeacherButton } from "./activate-teacher-button";
import { TeacherDashboardClient } from "./teacher-dashboard-client";

async function createClassGroup(formData: FormData) {
  "use server";

  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect("/signin?callbackUrl=/teacher");
  }

  if (!isTeacher(role)) {
    redirect("/teacher");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return;
  }

  await prisma.classGroup.create({
    data: {
      name,
      teacherId: session.user.id,
    },
  });

  revalidatePath("/teacher");
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
    invitesRaw,
    assignmentsRaw,
    approvedRecordingsRaw,
    enrollmentsRaw,
    directLinksRaw,
    teacherPlaybackEventsRaw,
    teacherAccessSubscriptionRaw,
    pendingInvites,
    totalAssignments,
  ] = await Promise.all([
    prisma.classGroup.findMany({
      where: { teacherId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            enrollments: true,
            assignments: true,
            invites: true,
          },
        },
      },
      take: 50,
    }),
    prisma.teacherInvite.findMany({
      where: { teacherId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        acceptedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 100,
    }),
    prisma.practiceAssignment.findMany({
      where: { assignedByTeacherId: session.user.id },
      orderBy: { createdAt: "desc" },
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
        _count: {
          select: {
            playbackEvents: true,
          },
        },
      },
      take: 120,
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
        durationMs: true,
        primaryPasuk: {
          select: {
            ref: true,
          },
        },
      },
      take: 200,
    }),
    prisma.classEnrollment.findMany({
      where: {
        group: {
          teacherId: session.user.id,
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        group: {
          select: {
            id: true,
            name: true,
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
      take: 300,
    }),
    prisma.teacherStudentLink.findMany({
      where: {
        teacherId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        invite: {
          select: {
            id: true,
            email: true,
            acceptedAt: true,
          },
        },
      },
      take: 300,
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
      take: 1000,
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
        take: 4000,
      })
    : [];

  const uniqueStudentIds = new Set<string>();
  for (const enrollment of enrollmentsRaw) {
    uniqueStudentIds.add(enrollment.student.id);
  }
  for (const directLink of directLinksRaw) {
    uniqueStudentIds.add(directLink.student.id);
  }

  const latestTeacherActivity = new Map<string, Date>();
  for (const event of teacherPlaybackEventsRaw) {
    const existingLatest = latestTeacherActivity.get(event.studentId);
    if (!existingLatest || existingLatest.getTime() < event.occurredAt.getTime()) {
      latestTeacherActivity.set(event.studentId, event.occurredAt);
    }
  }

  const groups = groupsRaw.map((group) => ({
    id: group.id,
    name: group.name,
    counts: {
      students: group._count.enrollments,
      invites: group._count.invites,
      assignments: group._count.assignments,
    },
  }));

  const invites = invitesRaw.map((invite) => ({
    id: invite.id,
    token: invite.token,
    email: invite.email,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
    kind: (invite.groupId ? "class" : "direct") as "class" | "direct",
    groupName: invite.group?.name ?? null,
    acceptedByName: invite.acceptedByUser?.name ?? null,
  }));

  const assignments = assignmentsRaw.map((assignment) => ({
    id: assignment.id,
    groupId: assignment.group.id,
    createdAt: assignment.createdAt.toISOString(),
    dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
    instructions: assignment.instructions,
    groupName: assignment.group.name,
    playbackEventCount: assignment._count.playbackEvents,
    recording: {
      title: assignment.recording.title,
      nussach: assignment.recording.nussach,
      nussachCustom: assignment.recording.nussachCustom,
      primaryPasukRef: assignment.recording.primaryPasuk.ref,
    },
  }));

  const latestStudentActivity = new Map<string, Date>();
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

    const existingLatest = latestStudentActivity.get(event.studentId);
    if (!existingLatest || existingLatest.getTime() < event.occurredAt.getTime()) {
      latestStudentActivity.set(event.studentId, event.occurredAt);
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

  const assignmentActivity = assignments.map((assignment) => {
    const rows = Array.from(assignmentActivityBuckets.get(assignment.id)?.values() ?? []).map((row) => {
      let topReplayPasukRef: string | null = null;
      let topReplayCount = 0;

      for (const [pasukRef, count] of row.replayByPasuk) {
        if (count > topReplayCount) {
          topReplayCount = count;
          topReplayPasukRef = pasukRef;
        }
      }

      return {
        studentId: row.studentId,
        studentName: row.studentName,
        studentEmail: row.studentEmail,
        totalEvents: row.totalEvents,
        replayEvents: row.replayEvents,
        lastOccurredAt: row.lastOccurredAt.toISOString(),
        topReplayPasukRef,
        topReplayCount,
      };
    });

    rows.sort((a, b) => new Date(b.lastOccurredAt).getTime() - new Date(a.lastOccurredAt).getTime());
    return {
      assignmentId: assignment.id,
      rows,
    };
  });

  const roster = enrollmentsRaw.map((enrollment) => ({
    id: enrollment.id,
    groupId: enrollment.group.id,
    groupName: enrollment.group.name,
    studentId: enrollment.student.id,
    studentName: enrollment.student.name,
    studentEmail: enrollment.student.email,
    joinedAt: enrollment.createdAt.toISOString(),
    lastActivityAt: latestStudentActivity.get(enrollment.student.id)?.toISOString() ?? null,
  }));

  const directStudents = directLinksRaw.map((link) => ({
    id: link.id,
    studentId: link.student.id,
    studentName: link.student.name,
    studentEmail: link.student.email,
    acceptedAt: link.invite?.acceptedAt ? link.invite.acceptedAt.toISOString() : null,
    inviteEmail: link.invite?.email ?? null,
    lastActivityAt: latestTeacherActivity.get(link.student.id)?.toISOString() ?? null,
  }));

  const approvedRecordings = approvedRecordingsRaw.map((recording) => ({
    id: recording.id,
    title: recording.title,
    nussach: recording.nussach,
    nussachCustom: recording.nussachCustom,
    durationMs: recording.durationMs,
    primaryPasukRef: recording.primaryPasuk.ref,
  }));

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
      <header className="mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Teacher Mode</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] md:text-4xl">Teacher Dashboard</h1>
          <p className="mt-2 text-sm text-orange-900/80">
            Direct 1-on-1 tutoring is the primary flow. Classes are optional when you want to group multiple students.
          </p>
        </div>
      </header>

      <details className="mb-6 rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <summary className="cursor-pointer text-lg font-bold text-orange-950">Optional class grouping</summary>
        <p className="mt-2 text-sm text-orange-900/80">
          Skip this if you tutor one student at a time. Create a class only when you want a shared roster for multiple students.
        </p>
        <form action={createClassGroup} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="w-full max-w-md text-sm font-semibold text-orange-950">
            Class Name
            <input
              className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
              maxLength={80}
              minLength={2}
              name="name"
              placeholder="Sunday Bnei Mitzvah Group"
              required
              type="text"
            />
          </label>
          <button className="rounded-full border border-orange-900/25 bg-white px-4 py-2 text-sm font-semibold text-orange-950 hover:bg-orange-100" type="submit">
            Create Class
          </button>
        </form>
      </details>

      <TeacherDashboardClient
        analytics={analytics}
              teacherAccess={teacherAccess}
        approvedRecordings={approvedRecordings}
        assignmentActivity={assignmentActivity}
        assignments={assignments}
        directStudents={directStudents}
        groups={groups}
        invites={invites}
        roster={roster}
      />
    </main>
  );
}
