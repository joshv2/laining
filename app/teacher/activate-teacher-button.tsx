"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ActivateTeacherButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleActivate() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/activate", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            couponCode: couponCode.trim() || undefined,
          }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error ?? "Could not activate teacher mode.");
        }

        setSuccess(data.message ?? "Teacher mode activated.");
        router.refresh();
        router.push("/teacher");
      } catch (activateError) {
        setError(activateError instanceof Error ? activateError.message : "Could not activate teacher mode.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-orange-900/75">
        Coupon Code (Optional)
        <input
          className="mt-1 w-full rounded-full border border-orange-900/20 bg-white px-3 py-2 text-sm font-medium text-orange-950"
          onChange={(event) => setCouponCode(event.target.value)}
          placeholder="TEACHER2026"
          value={couponCode}
        />
      </label>
      <button
        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        onClick={handleActivate}
        type="button"
      >
        {isPending ? "Activating..." : "Activate Teacher Account"}
      </button>
      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="text-xs font-semibold text-lime-700">{success}</p> : null}
    </div>
  );
}
