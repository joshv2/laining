"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type DirectAssignmentRow = {
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
};

type ClassAssignmentRow = {
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
  directAssignments: DirectAssignmentRow[];
  classAssignments: ClassAssignmentRow[];
  hasClasses: boolean;
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

export function TeacherDashboardClient({ directAssignments, classAssignments, hasClasses, analytics, teacherAccess }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);

  const filteredDirectRows = useMemo(
    () => (showOld ? directAssignments : directAssignments.filter((row) => !row.isOld)),
    [directAssignments, showOld],
  );

  const filteredClassRows = useMemo(
    () => (showOld ? classAssignments : classAssignments.filter((row) => !row.isOld)),
    [classAssignments, showOld],
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
              Status: {teacherAccess.status} - Source: {teacherAccess.source} - {" "}
              {teacherAccess.currencyCode} {(teacherAccess.priceCents / 100).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-orange-900/75">
              Activated: {formatDate(teacherAccess.activatedAt)}
              {teacherAccess.deactivatedAt ? ` - Deactivated: ${formatDate(teacherAccess.deactivatedAt)}` : ""}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            disabled={isPending}
            onClick={() => {
              void withStatus(() => handleDeactivateTeacher());
            }}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path d="M12 3v10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              <path d="M7 6.5a8 8 0 1 0 10 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
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

      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-orange-950">Active Student Assignments</h2>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-900/20 bg-white px-3 py-1">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-orange-900/70">Filter</span>
              <select
                className="bg-transparent text-xs font-semibold text-orange-950 outline-none"
                onChange={(event) => setShowOld(event.target.value === "all")}
                value={showOld ? "all" : "active"}
              >
                <option value="active">Active Only</option>
                <option value="all">Active + Old</option>
              </select>
            </div>
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Link className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200" href="/teacher/invite-student">
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                <path d="M4 6h16v12H4V6Zm2 1.8 6 4.2 6-4.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              Invite Student
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-200" href="/teacher/create-assignment">
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
              Create Assignment
            </Link>
          </div>
        </div>
        {filteredDirectRows.length === 0 ? (
          <p className="mt-3 text-sm text-orange-900/75">No direct student assignments for this filter.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-orange-900/15 text-left text-xs uppercase tracking-[0.08em] text-orange-900/70">
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Recording</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2">Events</th>
                  <th className="px-2 py-2">Replays</th>
                  <th className="px-2 py-2">Last Activity</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirectRows.map((row) => (
                  <tr key={`${row.assignmentId}-${row.studentId}`} className="border-b border-orange-900/10 align-top">
                    <td className="px-2 py-2 text-orange-950">
                      <Link className="font-semibold hover:underline" href={`/teacher/students/${row.studentId}`}>
                        {row.studentName ?? row.studentEmail ?? "Student"}
                      </Link>
                      <div className="text-xs text-orange-900/70">{row.studentEmail ?? "-"}</div>
                    </td>
                    <td className="px-2 py-2 text-orange-900/80">
                      {row.recordingLabel}
                      {row.instructions ? <div className="text-xs text-orange-900/70">{row.instructions}</div> : null}
                      {row.topReplayPasukRef ? (
                        <div className="text-xs text-orange-900/70">Top replay: {row.topReplayPasukRef} ({row.topReplayCount})</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-orange-900/80">{formatDate(row.dueAt)}</td>
                    <td className="px-2 py-2 text-orange-900/80">{row.totalEvents}</td>
                    <td className="px-2 py-2 text-orange-900/80">{row.replayEvents}</td>
                    <td className="px-2 py-2 text-orange-900/80">{formatDate(row.lastOccurredAt)}</td>
                    <td className="px-2 py-2 text-orange-900/80">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
                          disabled={isPending}
                          onClick={() => setEditingAssignmentId((current) => (current === row.assignmentId ? null : row.assignmentId))}
                          type="button"
                        >
                          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                            <path d="m4 20 4.5-1 9-9a1.5 1.5 0 0 0 0-2.1l-1.4-1.4a1.5 1.5 0 0 0-2.1 0l-9 9L4 20Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          </svg>
                          {editingAssignmentId === row.assignmentId ? "Cancel" : "Edit"}
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          disabled={isPending}
                          onClick={() => {
                            void withStatus(() => handleDeleteAssignment(row.assignmentId));
                          }}
                          type="button"
                        >
                          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                            <path d="M5 7h14M9 7V5h6v2m-7 0 1 12h6l1-12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          </svg>
                          Remove
                        </button>
                      </div>

                      {editingAssignmentId === row.assignmentId ? (
                        <form
                          className="mt-2 grid gap-2 rounded-lg border border-orange-900/10 bg-orange-50/60 p-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const formData = new FormData(event.currentTarget);
                            void withStatus(() => handleUpdateAssignment(formData));
                          }}
                        >
                          <input name="assignmentId" type="hidden" value={row.assignmentId} />
                          <label className="text-xs font-semibold text-orange-950">
                            Due Date
                            <input className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1" defaultValue={row.dueAt ? row.dueAt.slice(0, 10) : ""} name="dueAt" type="date" />
                          </label>
                          <label className="text-xs font-semibold text-orange-950">
                            Instructions
                            <textarea className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1" defaultValue={row.instructions ?? ""} maxLength={2000} name="instructions" rows={3} />
                          </label>
                          <button className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800" disabled={isPending} type="submit">
                            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                              <path d="M5 4h11l3 3v13H5V4Zm3 0v6h8V4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                            </svg>
                            Save
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {hasClasses ? (
        <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Class Assignments</h2>
          {filteredClassRows.length === 0 ? (
            <p className="mt-3 text-sm text-orange-900/75">No class assignments for this filter.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-orange-900/15 text-left text-xs uppercase tracking-[0.08em] text-orange-900/70">
                    <th className="px-2 py-2">Class</th>
                    <th className="px-2 py-2">Recording</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2">Students</th>
                    <th className="px-2 py-2">Logged In</th>
                    <th className="px-2 py-2">Events</th>
                    <th className="px-2 py-2">Replays</th>
                    <th className="px-2 py-2">Last Activity</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClassRows.map((row) => (
                    <tr key={row.assignmentId} className="border-b border-orange-900/10 align-top">
                      <td className="px-2 py-2 text-orange-950">
                        <Link className="font-semibold hover:underline" href={`/teacher/classes/${row.classId}`}>
                          {row.className}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-orange-900/80">
                        {row.recordingLabel}
                        {row.instructions ? <div className="text-xs text-orange-900/70">{row.instructions}</div> : null}
                      </td>
                      <td className="px-2 py-2 text-orange-900/80">{formatDate(row.dueAt)}</td>
                      <td className="px-2 py-2 text-orange-900/80">{row.totalStudents}</td>
                      <td className="px-2 py-2 text-orange-900/80">{row.studentsWithActivity}</td>
                      <td className="px-2 py-2 text-orange-900/80">{row.totalEvents}</td>
                      <td className="px-2 py-2 text-orange-900/80">{row.replayEvents}</td>
                      <td className="px-2 py-2 text-orange-900/80">{formatDate(row.lastOccurredAt)}</td>
                      <td className="px-2 py-2 text-orange-900/80">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
                            disabled={isPending}
                            onClick={() => setEditingAssignmentId((current) => (current === row.assignmentId ? null : row.assignmentId))}
                            type="button"
                          >
                            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                              <path d="m4 20 4.5-1 9-9a1.5 1.5 0 0 0 0-2.1l-1.4-1.4a1.5 1.5 0 0 0-2.1 0l-9 9L4 20Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                            </svg>
                            {editingAssignmentId === row.assignmentId ? "Cancel" : "Edit"}
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            disabled={isPending}
                            onClick={() => {
                              void withStatus(() => handleDeleteAssignment(row.assignmentId));
                            }}
                            type="button"
                          >
                            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                              <path d="M5 7h14M9 7V5h6v2m-7 0 1 12h6l1-12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                            </svg>
                            Remove
                          </button>
                        </div>

                        {editingAssignmentId === row.assignmentId ? (
                          <form
                            className="mt-2 grid gap-2 rounded-lg border border-orange-900/10 bg-orange-50/60 p-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const formData = new FormData(event.currentTarget);
                              void withStatus(() => handleUpdateAssignment(formData));
                            }}
                          >
                            <input name="assignmentId" type="hidden" value={row.assignmentId} />
                            <label className="text-xs font-semibold text-orange-950">
                              Due Date
                              <input className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1" defaultValue={row.dueAt ? row.dueAt.slice(0, 10) : ""} name="dueAt" type="date" />
                            </label>
                            <label className="text-xs font-semibold text-orange-950">
                              Instructions
                              <textarea className="mt-1 w-full rounded-lg border border-orange-900/20 bg-white px-2 py-1" defaultValue={row.instructions ?? ""} maxLength={2000} name="instructions" rows={3} />
                            </label>
                            <button className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800" disabled={isPending} type="submit">
                              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                <path d="M5 4h11l3 3v13H5V4Zm3 0v6h8V4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                              </svg>
                              Save
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h2 className="text-lg font-bold text-orange-950">Class Assignments</h2>
          <p className="mt-2 text-sm text-orange-900/75">No classes yet. Build classes from the Students page when needed.</p>
        </section>
      )}
    </div>
  );
}
