"use client";

import { useState, useTransition } from "react";

export function InviteStudentForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submitInvite() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/invites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            expiresInDays,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error ?? "Could not create invite.");
        }

        const token = data?.invite?.token as string | undefined;
        setMessage(token ? `Invite created. Share /teacher/invite/${token}` : "Invite created.");
        setEmail("");
        setExpiresInDays(7);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Could not create invite.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
      <h2 className="text-lg font-bold text-orange-950">Invite Student (Direct 1-on-1)</h2>
      <p className="mt-1 text-sm text-orange-900/80">This flow creates direct invites only. No class selection is required.</p>

      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submitInvite();
        }}
      >
        <label className="text-sm font-semibold text-orange-950">
          Student Email
          <input
            className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="text-sm font-semibold text-orange-950">
          Expiration (days)
          <input
            className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2"
            max={30}
            min={1}
            onChange={(event) => setExpiresInDays(Number(event.target.value || 7))}
            type="number"
            value={expiresInDays}
          />
        </label>

        <button
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Creating..." : "Create Invite"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm font-semibold text-lime-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
