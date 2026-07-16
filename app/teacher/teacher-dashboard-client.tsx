"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type GroupSummary = {
  id: string;
  name: string;
  counts: {
    students: number;
    invites: number;
    assignments: number;
  };
};

type RecordingOption = {
  id: string;
  title: string | null;
  nussach: string;
  nussachCustom: string | null;
  durationMs: number;
  primaryPasukRef: string;
};

type InviteSummary = {
  id: string;
  token: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  kind: "class" | "direct";
  groupName: string | null;
  acceptedByName: string | null;
};

type AssignmentSummary = {
  id: string;
  groupId: string;
  createdAt: string;
  dueAt: string | null;
  instructions: string | null;
  groupName: string;
  playbackEventCount: number;
  recording: {
    title: string | null;
    nussach: string;
    nussachCustom: string | null;
    primaryPasukRef: string;
  };
};

type AssignmentActivityRow = {
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  totalEvents: number;
  replayEvents: number;
  lastOccurredAt: string;
  topReplayPasukRef: string | null;
  topReplayCount: number;
};

type AssignmentActivitySummary = {
  assignmentId: string;
  rows: AssignmentActivityRow[];
};

type RosterItem = {
  id: string;
  groupId: string;
  groupName: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  joinedAt: string;
  lastActivityAt: string | null;
};

type DirectStudentItem = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  acceptedAt: string | null;
  inviteEmail: string | null;
  lastActivityAt: string | null;
};

type AnalyticsSummary = {
  totalStudents: number;
  pendingInvites: number;
  totalAssignments: number;
  weeklyAssignmentEvents: number;
  weeklyActiveStudents: number;
};

type TeacherAccessSummary = {
  status: "ACTIVE" | "CANCELED";
  source: "FREE" | "COUPON" | "STRIPE";
  priceCents: number;
  currencyCode: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
};

type Props = {
  groups: GroupSummary[];
  approvedRecordings: RecordingOption[];
  invites: InviteSummary[];
  assignments: AssignmentSummary[];
  assignmentActivity: AssignmentActivitySummary[];
  directStudents: DirectStudentItem[];
  roster: RosterItem[];
  analytics: AnalyticsSummary;
  teacherAccess: TeacherAccessSummary;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
  });
}

function inviteState(invite: InviteSummary): "accepted" | "expired" | "pending" {
  if (invite.acceptedAt) {
    return "accepted";
  }

  const expires = new Date(invite.expiresAt);
  if (!Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
    return "expired";
  }

  return "pending";
}

export function TeacherDashboardClient({ groups, approvedRecordings, invites, assignments, assignmentActivity, directStudents, roster, analytics, teacherAccess }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const defaultGroupId = groups[0]?.id ?? "";
  const defaultRecordingId = approvedRecordings[0]?.id ?? "";

  const pendingInvites = useMemo(() => invites.filter((invite) => inviteState(invite) === "pending"), [invites]);
  const activityByAssignmentId = useMemo(
    () => new Map(assignmentActivity.map((item) => [item.assignmentId, item.rows])),
    [assignmentActivity],
  );

  async function withStatus(task: () => Promise<void>) {
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Request failed");
      }
    });
  }

  async function parseJson(response: Response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as { error?: string }).error ?? "Request failed");
    }
    return data;
  }

  async function handleCreateInvite(formData: FormData) {
    const groupId = String(formData.get("groupId") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const expiresInDays = Number(formData.get("expiresInDays") ?? "7");
    const useDirect = groupId === "__DIRECT__";

    if ((!useDirect && !groupId) || !email) {
      throw new Error("Email is required.");
    }

    const response = await fetch("/api/teacher/invites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        expiresInDays,
        ...(useDirect ? {} : { groupId }),
      }),
    });

    await parseJson(response);
    setStatusMessage("Invite created.");
    router.refresh();
  }

  async function handleCreateAssignment(formData: FormData) {
    const groupId = String(formData.get("groupId") ?? "").trim();
    const recordingId = String(formData.get("recordingId") ?? "").trim();
    const instructions = String(formData.get("instructions") ?? "").trim();
    const dueAt = String(formData.get("dueAt") ?? "").trim();

    if (!groupId || !recordingId) {
      throw new Error("Class and recording are required.");
    }

    const response = await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId,
        recordingId,
        instructions: instructions || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      }),
    });

    await parseJson(response);
    setStatusMessage("Assignment created.");
    router.refresh();
  }

  async function handleCreateDirectAssignment(formData: FormData) {
    const directStudentId = String(formData.get("directStudentId") ?? "").trim();
    const recordingId = String(formData.get("recordingId") ?? "").trim();
    const instructions = String(formData.get("instructions") ?? "").trim();
    const dueAt = String(formData.get("dueAt") ?? "").trim();

    if (!directStudentId || !recordingId) {
      throw new Error("Student and recording are required.");
    }

    const response = await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        directStudentId,
        recordingId,
        instructions: instructions || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      }),
    });

    await parseJson(response);
    setStatusMessage("Direct student assignment created.");
    router.refresh();
  }

  async function handleResendInvite(inviteId: string) {
    const response = await fetch(`/api/teacher/invites/${inviteId}/resend`, {
      method: "POST",
    });
    await parseJson(response);
    setStatusMessage("Invite resent and expiration extended.");
    router.refresh();
  }

  async function handleRevokeInvite(inviteId: string) {
    const response = await fetch(`/api/teacher/invites/${inviteId}`, {
      method: "DELETE",
    });
    await parseJson(response);
    setStatusMessage("Invite revoked.");
    router.refresh();
  }

  async function handleDeleteAssignment(assignmentId: string) {
    const response = await fetch(`/api/teacher/assignments/${assignmentId}`, {
      method: "DELETE",
    });
    await parseJson(response);
    setStatusMessage("Assignment removed.");
    router.refresh();
  }

  async function handleUpdateAssignment(formData: FormData) {
    const assignmentId = String(formData.get("assignmentId") ?? "").trim();
    const instructionsRaw = String(formData.get("instructions") ?? "").trim();
    const dueAtRaw = String(formData.get("dueAt") ?? "").trim();

    if (!assignmentId) {
      throw new Error("Assignment ID is required.");
    }

    const response = await fetch(`/api/teacher/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instructions: instructionsRaw ? instructionsRaw : null,
        dueAt: dueAtRaw ? new Date(dueAtRaw).toISOString() : null,
      }),
    });

    await parseJson(response);
    setEditingAssignmentId(null);
    setStatusMessage("Assignment updated.");
    router.refresh();
  }

  async function handleRemoveEnrollment(enrollmentId: string) {
    const response = await fetch(`/api/teacher/enrollments/${enrollmentId}`, {
      method: "DELETE",
    });
    await parseJson(response);
    setStatusMessage("Student removed from class.");
    router.refresh();
  }

  async function handleCopyInviteLink(token: string) {
    if (typeof window === "undefined") {
      throw new Error("Invite link can only be copied in a browser.");
    }

    const inviteUrl = `${window.location.origin}/teacher/invite/${token}`;
    await navigator.clipboard.writeText(inviteUrl);
    setStatusMessage("Invite link copied.");
  }

  async function handleDeactivateTeacher() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Deactivate teacher mode? You will lose teacher dashboard access until re-activated.");
      if (!confirmed) {
        return;
      }
    }

    const response = await fetch("/api/teacher/deactivate", {
      method: "POST",
    });

    const data = await parseJson(response);
    setStatusMessage(data?.result?.message ?? "Teacher mode deactivated.");
    router.refresh();
    router.push("/teacher");
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-orange-950">Teacher Access & Billing</h2>
            <p className="mt-1 text-sm text-orange-900/80">
              Status: {teacherAccess.status} - Source: {teacherAccess.source} -
              {" "}{teacherAccess.currencyCode} {(teacherAccess.priceCents / 100).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-orange-900/75">
              Activated: {formatDate(teacherAccess.activatedAt)}
              {teacherAccess.deactivatedAt ? ` - Deactivated: ${formatDate(teacherAccess.deactivatedAt)}` : ""}
            </p>
          </div>
          <button
            className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              void withStatus(() => handleDeactivateTeacher());
            }}
            type="button"
          >
            Deactivate Teacher Mode
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-xl border border-orange-900/15 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900/70">Students</p>
          <p className="mt-2 text-2xl font-bold text-orange-950">{analytics.totalStudents}</p>
        </article>
        <article className="rounded-xl border border-orange-900/15 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900/70">Pending Invites</p>
          <p className="mt-2 text-2xl font-bold text-orange-950">{analytics.pendingInvites}</p>
        </article>
        <article className="rounded-xl border border-orange-900/15 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900/70">Assignments</p>
          <p className="mt-2 text-2xl font-bold text-orange-950">{analytics.totalAssignments}</p>
        </article>
        <article className="rounded-xl border border-orange-900/15 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900/70">Events (7d)</p>
          <p className="mt-2 text-2xl font-bold text-orange-950">{analytics.weeklyAssignmentEvents}</p>
        </article>
        <article className="rounded-xl border border-orange-900/15 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-900/70">Active Students (7d)</p>
          <p className="mt-2 text-2xl font-bold text-orange-950">{analytics.weeklyActiveStudents}</p>
        </article>
      </section>

      {statusMessage ? (
        <div className="rounded-xl border border-orange-900/15 bg-orange-100/70 px-4 py-2 text-sm font-semibold text-orange-900">{statusMessage}</div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Invite Student</h2>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void withStatus(() => handleCreateInvite(formData));
            }}
          >
            <label className="text-sm font-semibold text-orange-950">
              Class / Direct
              <select className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" defaultValue="__DIRECT__" name="groupId" required>
                <option value="__DIRECT__">Direct 1-on-1 (no class)</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-orange-950">
              Student Email
              <input className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" name="email" required type="email" />
            </label>
            <label className="text-sm font-semibold text-orange-950">
              Expiration (days)
              <input className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" defaultValue={7} max={30} min={1} name="expiresInDays" type="number" />
            </label>
            <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50" disabled={isPending} type="submit">
              Create Invite
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Create Assignment</h2>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void withStatus(() => handleCreateAssignment(formData));
            }}
          >
            <label className="text-sm font-semibold text-orange-950">
              Class
              <select className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" defaultValue={defaultGroupId} name="groupId" required>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-orange-950">
              Recording
              <select className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" defaultValue={defaultRecordingId} name="recordingId" required>
                {approvedRecordings.map((recording) => (
                  <option key={recording.id} value={recording.id}>
                    {recording.title ? `${recording.title} - ` : ""}
                    {recording.primaryPasukRef} - {recording.nussach}{recording.nussachCustom ? ` (${recording.nussachCustom})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-orange-950">
              Due Date
              <input className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" name="dueAt" type="date" />
            </label>
            <label className="text-sm font-semibold text-orange-950">
              Instructions
              <textarea className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" maxLength={2000} name="instructions" rows={3} />
            </label>
            <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50" disabled={isPending} type="submit">
              Assign Recording
            </button>
          </form>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Invites</h2>
          {invites.length === 0 ? (
            <p className="mt-3 text-sm text-orange-900/75">No invites yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {invites.map((invite) => {
                const state = inviteState(invite);
                return (
                  <li key={invite.id} className="rounded-xl border border-orange-900/15 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-orange-950">{invite.email}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        state === "accepted"
                          ? "bg-lime-100 text-lime-900"
                          : state === "expired"
                            ? "bg-zinc-200 text-zinc-800"
                            : "bg-amber-100 text-amber-900"
                      }`}>
                        {state}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-orange-900/75">
                        {invite.kind === "direct" ? "Direct 1-on-1" : invite.groupName ?? "Class invite"} - Expires {formatDate(invite.expiresAt)}
                      {invite.acceptedByName ? ` - Accepted by ${invite.acceptedByName}` : ""}
                    </p>
                    {state !== "accepted" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-orange-900/20 px-3 py-1 text-xs font-semibold hover:bg-orange-100 disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => {
                            void withStatus(() => handleCopyInviteLink(invite.token));
                          }}
                          type="button"
                        >
                          Copy Link
                        </button>
                        <a
                          className="rounded-full border border-orange-900/20 px-3 py-1 text-xs font-semibold hover:bg-orange-100"
                          href={`/teacher/invite/${invite.token}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open Link
                        </a>
                        <button
                          className="rounded-full border border-orange-900/20 px-3 py-1 text-xs font-semibold hover:bg-orange-100 disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => {
                            void withStatus(() => handleResendInvite(invite.id));
                          }}
                          type="button"
                        >
                          Resend
                        </button>
                        <button
                          className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => {
                            void withStatus(() => handleRevokeInvite(invite.id));
                          }}
                          type="button"
                        >
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => {
                            void withStatus(() => handleRevokeInvite(invite.id));
                          }}
                          type="button"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Assignments</h2>
          {assignments.length === 0 ? (
            <p className="mt-3 text-sm text-orange-900/75">No assignments yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {assignments.map((assignment) => (
                <li key={assignment.id} className="rounded-xl border border-orange-900/15 bg-white p-3">
                  <p className="text-sm font-semibold text-orange-950">
                    {assignment.recording.title ? `${assignment.recording.title} - ` : ""}
                    {assignment.recording.primaryPasukRef} - {assignment.recording.nussach}
                    {assignment.recording.nussachCustom ? ` (${assignment.recording.nussachCustom})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-orange-900/75">
                    Class: {assignment.groupName} - Due: {formatDate(assignment.dueAt)} - Events: {assignment.playbackEventCount}
                  </p>
                  {assignment.instructions ? <p className="mt-1 text-xs text-orange-900/75">{assignment.instructions}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className="rounded-full border border-orange-900/20 px-3 py-1 text-xs font-semibold hover:bg-orange-100 disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => {
                        setEditingAssignmentId((current) => (current === assignment.id ? null : assignment.id));
                      }}
                      type="button"
                    >
                      {editingAssignmentId === assignment.id ? "Cancel Edit" : "Edit Assignment"}
                    </button>
                    <button
                      className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => {
                        void withStatus(() => handleDeleteAssignment(assignment.id));
                      }}
                      type="button"
                    >
                      Remove Assignment
                    </button>
                  </div>

                  {editingAssignmentId === assignment.id ? (
                    <form
                      className="mt-3 grid gap-2 rounded-lg border border-orange-900/10 bg-orange-50/60 p-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        void withStatus(() => handleUpdateAssignment(formData));
                      }}
                    >
                      <input name="assignmentId" type="hidden" value={assignment.id} />
                      <label className="text-xs font-semibold text-orange-950">
                        Due Date
                        <input
                          className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1"
                          defaultValue={assignment.dueAt ? assignment.dueAt.slice(0, 10) : ""}
                          name="dueAt"
                          type="date"
                        />
                      </label>
                      <label className="text-xs font-semibold text-orange-950">
                        Instructions
                        <textarea
                          className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1"
                          defaultValue={assignment.instructions ?? ""}
                          maxLength={2000}
                          name="instructions"
                          rows={3}
                        />
                      </label>
                      <button
                        className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
                        disabled={isPending}
                        type="submit"
                      >
                        Save Assignment
                      </button>
                    </form>
                  ) : null}

                  <div className="mt-3 rounded-lg border border-orange-900/10 bg-orange-50/50 p-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-orange-900/70">Student Activity Timeline</p>
                    {(() => {
                      const rows = activityByAssignmentId.get(assignment.id) ?? [];
                      if (rows.length === 0) {
                        return <p className="mt-1 text-xs text-orange-900/70">No playback activity yet.</p>;
                      }

                      return (
                        <ul className="mt-2 space-y-1">
                          {rows.slice(0, 6).map((row) => (
                            <li key={`${assignment.id}-${row.studentId}`} className="rounded border border-orange-900/10 bg-white px-2 py-1 text-xs text-orange-900/80">
                              <span className="font-semibold text-orange-950">{row.studentName ?? row.studentEmail ?? "Student"}</span>
                              {" - "}
                              Last active {formatDate(row.lastOccurredAt)}
                              {" - "}
                              Events {row.totalEvents}
                              {" - "}
                              Replays {row.replayEvents}
                              {row.topReplayPasukRef ? ` - Most replayed ${row.topReplayPasukRef} (${row.topReplayCount})` : ""}
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <h2 className="text-lg font-bold text-orange-950">Classes</h2>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-orange-900/75">No classes yet. Create one above to start inviting students.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {groups.map((group) => (
              <li key={group.id} className="rounded-xl border border-orange-900/15 bg-white p-4">
                <p className="font-semibold text-orange-950">{group.name}</p>
                <p className="mt-1 text-xs text-orange-900/75">
                  Students: {group.counts.students} - Invites: {group.counts.invites} - Assignments: {group.counts.assignments}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <h2 className="text-lg font-bold text-orange-950">Direct Students</h2>
        {directStudents.length === 0 ? (
          <p className="mt-3 text-sm text-orange-900/75">No direct 1-on-1 students yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {directStudents.map((student) => (
              <li key={student.id} className="rounded-xl border border-orange-900/15 bg-white p-3">
                <p className="text-sm font-semibold text-orange-950">{student.studentName ?? student.studentEmail ?? "Student"}</p>
                <p className="mt-1 text-xs text-orange-900/75">
                  Invite: {student.inviteEmail ?? "Direct invite"} - Accepted: {formatDate(student.acceptedAt)} - Last activity: {formatDate(student.lastActivityAt)}
                </p>
                <form
                  className="mt-3 grid gap-2 rounded-lg border border-orange-900/10 bg-orange-50/60 p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    void withStatus(() => handleCreateDirectAssignment(formData));
                  }}
                >
                  <input name="directStudentId" type="hidden" value={student.studentId} />
                  <label className="text-xs font-semibold text-orange-950">
                    Assign recording
                    <select className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1" defaultValue={defaultRecordingId} name="recordingId" required>
                      {approvedRecordings.map((recording) => (
                        <option key={recording.id} value={recording.id}>
                          {recording.title ? `${recording.title} - ` : ""}
                          {recording.primaryPasukRef} - {recording.nussach}{recording.nussachCustom ? ` (${recording.nussachCustom})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-orange-950">
                    Due Date
                    <input className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1" name="dueAt" type="date" />
                  </label>
                  <label className="text-xs font-semibold text-orange-950">
                    Instructions
                    <textarea className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1" maxLength={2000} name="instructions" rows={2} />
                  </label>
                  <button
                    className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
                    disabled={isPending}
                    type="submit"
                  >
                    Assign To Student
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <h2 className="text-lg font-bold text-orange-950">Student Roster</h2>
        {roster.length === 0 ? (
          <p className="mt-3 text-sm text-orange-900/75">No enrolled students yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {roster.map((student) => (
              <li key={student.id} className="rounded-xl border border-orange-900/15 bg-white p-3">
                <p className="text-sm font-semibold text-orange-950">{student.studentName ?? student.studentEmail ?? "Student"}</p>
                <p className="mt-1 text-xs text-orange-900/75">
                  Class: {student.groupName} - Joined: {formatDate(student.joinedAt)} - Last activity: {formatDate(student.lastActivityAt)}
                </p>
                <div className="mt-2">
                  <button
                    className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={isPending}
                    onClick={() => {
                      void withStatus(() => handleRemoveEnrollment(student.id));
                    }}
                    type="button"
                  >
                    Remove From Class
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingInvites.length === 0 ? null : (
        <p className="text-xs font-semibold text-orange-900/75">Pending invites currently visible: {pendingInvites.length}</p>
      )}
    </div>
  );
}
