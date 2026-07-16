import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

import { AcceptInviteButton } from "./accept-invite-button";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function TeacherInvitePage({ params }: PageProps) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/teacher/invite/${token}`)}`);
  }

  const invite = await prisma.teacherInvite.findUnique({
    where: { token },
    include: {
      teacher: {
        select: {
          name: true,
          email: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
        },
      },
      acceptedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!invite) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-6 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
          <h1 className="text-2xl font-bold text-orange-950">Invite not found</h1>
          <p className="mt-3 text-sm text-orange-900/80">This invite link is invalid or no longer available.</p>
          <Link className="mt-5 inline-block rounded-full border border-orange-900/25 px-4 py-2 text-sm font-semibold hover:bg-orange-100" href="/learn">
            Go to Learn
          </Link>
        </section>
      </main>
    );
  }

  const accountEmail = session.user.email?.trim().toLowerCase() ?? "";
  const inviteEmail = invite.email.trim().toLowerCase();
  const expired = invite.expiresAt.getTime() < new Date().getTime();
  const acceptedByOther = Boolean(invite.acceptedAt && invite.acceptedByUserId && invite.acceptedByUserId !== session.user.id);
  const acceptedByYou = Boolean(invite.acceptedAt && invite.acceptedByUserId === session.user.id);
  const emailMismatch = accountEmail !== inviteEmail;
  const inviteLabel = invite.group?.name ?? "Direct 1-on-1 tutoring";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-6 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-900/70">Teacher Invite</p>
        <h1 className="mt-2 text-2xl font-bold text-orange-950">Join {inviteLabel}</h1>
        <p className="mt-2 text-sm text-orange-900/80">
          Teacher: {invite.teacher.name ?? invite.teacher.email ?? "Unknown"}
        </p>
        <p className="mt-1 text-sm text-orange-900/80">Invited email: {invite.email}</p>
        {invite.group ? null : (
          <p className="mt-1 text-sm text-orange-900/80">This is a direct tutoring invite. No class enrollment is required.</p>
        )}

        {acceptedByYou ? (
          <p className="mt-5 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-900">
            You already accepted this invite. Open Learn to start practicing assigned recordings.
          </p>
        ) : acceptedByOther ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            This invite has already been accepted by another account.
          </p>
        ) : expired ? (
          <p className="mt-5 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-800">
            This invite has expired. Ask your teacher to resend it.
          </p>
        ) : emailMismatch ? (
          <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            This invite is for {invite.email}, but you are signed in as {session.user.email ?? "an account without email"}. Sign in with the invited email.
          </p>
        ) : (
          <AcceptInviteButton token={token} />
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link className="rounded-full border border-orange-900/25 px-4 py-2 text-sm font-semibold hover:bg-orange-100" href="/learn">
            Open Learn
          </Link>
        </div>
      </section>
    </main>
  );
}
