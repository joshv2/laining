import Link from "next/link";
import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

function formatDateTime(value: Date): string {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function SuperuserNotificationsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user || role !== Role.SUPERUSER) {
    return (
      <div className="px-6 py-12 md:px-12">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-6">
          <h1 className="text-2xl font-bold text-orange-950">Superuser Notification Channel</h1>
          <p className="mt-2 text-sm text-orange-900/80">You need superuser access to view this inbox.</p>
        </div>
      </div>
    );
  }

  const notifications = await prisma.superuserNotification.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 120,
  });

  return (
    <div className="px-6 py-10 md:px-12">
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-orange-900/20 bg-[var(--surface)] p-6 shadow-[0_18px_42px_rgba(88,31,13,0.12)] md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-orange-950">Superuser Notification Channel</h1>
          <Link className="rounded-full border border-orange-900/20 px-4 py-2 text-sm font-semibold text-orange-950 hover:bg-orange-50" href="/contact">
            Open contact form
          </Link>
        </div>

        {notifications.length === 0 ? (
          <p className="mt-6 text-sm text-orange-900/80">No notifications yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {notifications.map((notification) => (
              <li key={notification.id} className={`rounded-2xl border p-4 ${notification.readAt ? "border-orange-900/15 bg-white" : "border-amber-500/35 bg-amber-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold text-orange-950">{notification.title}</p>
                  <span className="text-xs font-semibold uppercase tracking-wide text-orange-900/70">
                    {notification.readAt ? "Read" : "Unread"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-orange-900/85">{notification.body}</p>
                <p className="mt-2 text-xs text-orange-900/70">{formatDateTime(notification.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
