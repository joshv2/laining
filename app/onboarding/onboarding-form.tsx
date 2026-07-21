"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function OnboardingForm() {
  const router = useRouter();
  const { update } = useSession();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inviteCode: inviteCode.trim() }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          role?: string;
          userId?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Could not complete onboarding.");
        }

        await update({
          authStatus: "active",
          role: data.role,
          userId: data.userId,
        });

        router.replace("/learn");
        router.refresh();
      } catch (onboardingError) {
        setError(onboardingError instanceof Error ? onboardingError.message : "Could not complete onboarding.");
      }
    });
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm font-semibold text-orange-950">
        Invite Code
        <input
          className="mt-1 w-full rounded-2xl border border-orange-900/20 bg-white px-4 py-3 text-sm text-orange-950 outline-none transition focus:border-orange-700 focus:ring-2 focus:ring-orange-200"
          onChange={(event) => setInviteCode(event.target.value)}
          placeholder="Optional: paste the invite token from your teacher"
          value={inviteCode}
        />
        <span className="mt-2 block text-xs font-normal text-orange-900/70">
          Leave this blank to continue as a public user.
        </span>
      </label>

      <button
        className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Verifying..." : inviteCode.trim() ? "Join with Invite" : "Continue as Public User"}
      </button>

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}