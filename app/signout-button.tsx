"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="rounded-full border border-orange-900/20 px-3 py-1.5 text-xs font-semibold text-orange-900 hover:bg-orange-100 md:text-sm"
      type="button"
      onClick={() => signOut({ callbackUrl: "/signin" })}
    >
      Sign Out
    </button>
  );
}
