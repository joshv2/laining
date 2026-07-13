"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
};

export function AcceptInviteButton({ token }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/invites/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage((data as { error?: string }).error ?? "Could not accept invite.");
          return;
        }

        setMessage("Invite accepted. You can now access teacher assignments in Learn.");
        router.refresh();
      } catch {
        setMessage("Could not accept invite.");
      }
    });
  }

  return (
    <div className="mt-5 grid gap-3">
      <button
        className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
        disabled={isPending}
        onClick={handleAccept}
        type="button"
      >
        {isPending ? "Accepting..." : "Accept Invite"}
      </button>
      {message ? <p className="text-sm font-semibold text-orange-900">{message}</p> : null}
    </div>
  );
}
