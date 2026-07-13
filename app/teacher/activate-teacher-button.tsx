"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ActivateTeacherButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleActivate() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/activate", { method: "POST" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error ?? "Could not activate teacher mode.");
        }

        router.refresh();
        router.push("/teacher");
      } catch (activateError) {
        setError(activateError instanceof Error ? activateError.message : "Could not activate teacher mode.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        onClick={handleActivate}
        type="button"
      >
        {isPending ? "Activating..." : "Activate Teacher Account"}
      </button>
      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
