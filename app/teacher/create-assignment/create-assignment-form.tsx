"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type StudentOption = {
  id: string;
  label: string;
};

type ClassOption = {
  id: string;
  name: string;
};

type RecordingOption = {
  id: string;
  label: string;
};

type Props = {
  students: StudentOption[];
  classes: ClassOption[];
  recordings: RecordingOption[];
};

export function CreateAssignmentForm({ students, classes, recordings }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [targetMode, setTargetMode] = useState<"student" | "class">("student");
  const [directStudentId, setDirectStudentId] = useState(students[0]?.id ?? "");
  const [classId, setClassId] = useState(searchParams.get("classId") ?? classes[0]?.id ?? "");
  const [recordingId, setRecordingId] = useState(recordings[0]?.id ?? "");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAssignStudent = students.length > 0;
  const canAssignClass = classes.length > 0;

  const disableSubmit = useMemo(() => {
    if (!recordingId) return true;
    if (targetMode === "student") {
      return !directStudentId;
    }

    return !classId;
  }, [classId, directStudentId, recordingId, targetMode]);

  function onSubmit() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const payload: {
          recordingId: string;
          instructions?: string;
          dueAt?: string;
          directStudentId?: string;
          groupId?: string;
        } = {
          recordingId,
        };

        if (instructions.trim()) {
          payload.instructions = instructions.trim();
        }

        if (dueAt) {
          payload.dueAt = new Date(dueAt).toISOString();
        }

        if (targetMode === "student") {
          payload.directStudentId = directStudentId;
        } else {
          payload.groupId = classId;
        }

        const response = await fetch("/api/teacher/assignments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error ?? "Could not create assignment.");
        }

        setMessage("Assignment created.");
        setInstructions("");
        setDueAt("");
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Could not create assignment.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
      <h2 className="text-lg font-bold text-orange-950">Create Assignment</h2>
      <p className="mt-1 text-sm text-orange-900/80">Default flow assigns recordings directly to individual students.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            targetMode === "student" ? "bg-orange-900 text-white" : "border border-orange-900/20 bg-white text-orange-950"
          }`}
          disabled={!canAssignStudent}
          onClick={() => setTargetMode("student")}
          type="button"
        >
          Assign to Student
        </button>
        <button
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            targetMode === "class" ? "bg-orange-900 text-white" : "border border-orange-900/20 bg-white text-orange-950"
          }`}
          disabled={!canAssignClass}
          onClick={() => setTargetMode("class")}
          type="button"
        >
          Assign to Class
        </button>
      </div>

      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        {targetMode === "student" ? (
          <label className="text-sm font-semibold text-orange-950">
            Student
            <select
              className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
              onChange={(event) => setDirectStudentId(event.target.value)}
              required
              value={directStudentId}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-sm font-semibold text-orange-950">
            Class
            <select
              className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
              onChange={(event) => setClassId(event.target.value)}
              required
              value={classId}
            >
              {classes.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-sm font-semibold text-orange-950">
          Recording
          <select
            className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
            onChange={(event) => setRecordingId(event.target.value)}
            required
            value={recordingId}
          >
            {recordings.map((recording) => (
              <option key={recording.id} value={recording.id}>
                {recording.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-orange-950">
          Due Date
          <input
            className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
            onChange={(event) => setDueAt(event.target.value)}
            type="date"
            value={dueAt}
          />
        </label>

        <label className="text-sm font-semibold text-orange-950">
          Instructions
          <textarea
            className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
            maxLength={2000}
            onChange={(event) => setInstructions(event.target.value)}
            rows={4}
            value={instructions}
          />
        </label>

        <button
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
          disabled={isPending || disableSubmit}
          type="submit"
        >
          {isPending ? "Assigning..." : "Create Assignment"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm font-semibold text-lime-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
