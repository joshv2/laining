"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="rounded-full border border-orange-800/35 px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100"
      type="button"
      onClick={() => signOut({ callbackUrl: "/signin" })}
    >
      Sign Out
    </button>
  );
}
