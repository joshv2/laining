"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type StudentRow = {
  id: string;
  name: string | null;
  email: string | null;
  lastActivityAt: string | null;
  classes: {
    id: string;
    name: string;
  }[];
};

type ClassOption = {
  id: string;
  name: string;
};

type Props = {
  students: StudentRow[];
  classes: ClassOption[];
};

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-US", { timeZone: "UTC" });
}

export function StudentsPageClient({ students, classes }: Props) {
  const router = useRouter();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [targetMode, setTargetMode] = useState<"existing" | "new">("existing");
  const [groupId, setGroupId] = useState(classes[0]?.id ?? "");
  const [newClassName, setNewClassName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = useMemo(
    () => students.length > 0 && selectedStudentIds.length === students.length,
    [selectedStudentIds.length, students.length],
  );

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) => {
      if (current.includes(studentId)) {
        return current.filter((id) => id !== studentId);
      }

      return [...current, studentId];
    });
  }

  function toggleAll() {
    setSelectedStudentIds((current) => {
      if (current.length === students.length) {
        return [];
      }

      return students.map((student) => student.id);
    });
  }

  function createEnrollmentBatch() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        if (selectedStudentIds.length === 0) {
          throw new Error("Select at least one student.");
        }

        if (targetMode === "existing" && !groupId) {
          throw new Error("Select a class.");
        }

        if (targetMode === "new" && newClassName.trim().length < 2) {
          throw new Error("Class name must be at least 2 characters.");
        }

        const response = await fetch("/api/teacher/enrollments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studentIds: selectedStudentIds,
            ...(targetMode === "existing" ? { groupId } : { className: newClassName.trim() }),
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error ?? "Could not add students to class.");
        }

        setMessage(
          `Updated class ${data.group?.name ?? ""}. Added ${data.summary?.createdEnrollments ?? 0}, already enrolled ${data.summary?.alreadyEnrolled ?? 0}.`,
        );
        setSelectedStudentIds([]);
        if (targetMode === "new") {
          setNewClassName("");
        }
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Could not add students to class.");
      }
    });
  }

  return (
    <section className="grid gap-4">
      <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <h2 className="text-lg font-bold text-orange-950">Build Class From Selected Students</h2>
        <p className="mt-1 text-sm text-orange-900/80">Select direct students below, then add them to an existing class or create a new class.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              targetMode === "existing" ? "bg-orange-900 text-white" : "border border-orange-900/20 bg-white text-orange-950"
            }`}
            onClick={() => setTargetMode("existing")}
            type="button"
          >
            Existing Class
          </button>
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              targetMode === "new" ? "bg-orange-900 text-white" : "border border-orange-900/20 bg-white text-orange-950"
            }`}
            onClick={() => setTargetMode("new")}
            type="button"
          >
            New Class
          </button>
        </div>

        {targetMode === "existing" ? (
          <label className="mt-3 block text-sm font-semibold text-orange-950">
            Class
            <select
              className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
              onChange={(event) => setGroupId(event.target.value)}
              value={groupId}
            >
              {classes.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="mt-3 block text-sm font-semibold text-orange-950">
            New Class Name
            <input
              className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
              maxLength={80}
              minLength={2}
              onChange={(event) => setNewClassName(event.target.value)}
              placeholder="Sunday Bnei Mitzvah"
              value={newClassName}
            />
          </label>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
            disabled={isPending || selectedStudentIds.length === 0}
            onClick={() => {
              void createEnrollmentBatch();
            }}
            type="button"
          >
            {isPending ? "Saving..." : `Add ${selectedStudentIds.length} Student${selectedStudentIds.length === 1 ? "" : "s"}`}
          </button>
          <span className="text-xs font-semibold text-orange-900/75">Selected: {selectedStudentIds.length}</span>
        </div>

        {message ? <p className="mt-2 text-sm font-semibold text-lime-800">{message}</p> : null}
        {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
      </article>

      <article className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-orange-950">Students</h2>
          <button
            className="rounded-full border border-orange-900/20 px-3 py-1 text-xs font-semibold hover:bg-orange-100"
            onClick={toggleAll}
            type="button"
          >
            {allSelected ? "Clear All" : "Select All"}
          </button>
        </div>

        {students.length === 0 ? (
          <p className="mt-3 text-sm text-orange-900/75">No direct students yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-orange-900/15 text-left text-xs uppercase tracking-[0.08em] text-orange-900/70">
                  <th className="px-2 py-2">
                    <input
                      aria-label="Select all students"
                      checked={allSelected}
                      onChange={toggleAll}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Classes</th>
                  <th className="px-2 py-2">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const checked = selectedStudentIds.includes(student.id);
                  return (
                    <tr key={student.id} className="border-b border-orange-900/10 align-top">
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Select ${student.name ?? student.email ?? "student"}`}
                          checked={checked}
                          onChange={() => toggleStudent(student.id)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-2 py-2 font-semibold text-orange-950">
                        <Link className="hover:underline" href={`/teacher/students/${student.id}`}>
                          {student.name ?? "Student"}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-orange-900/80">{student.email ?? "-"}</td>
                      <td className="px-2 py-2 text-orange-900/80">
                        {student.classes.length === 0
                          ? "-"
                          : student.classes.map((group) => group.name).join(", ")}
                      </td>
                      <td className="px-2 py-2 text-orange-900/80">{formatDate(student.lastActivityAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
