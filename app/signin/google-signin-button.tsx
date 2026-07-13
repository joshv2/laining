"use client";

import { signIn } from "next-auth/react";

type Props = {
  callbackUrl?: string;
};

export function GoogleSignInButton({ callbackUrl = "/" }: Props) {
  return (
    <button
      className="mt-8 block w-full rounded-full bg-[var(--accent)] px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]"
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
    >
      Continue with Google
    </button>
  );
}
