import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RecordingStatus, Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { isModeratorOrAbove } from "@/lib/auth/roles";
import { ModerationAudioReviewer } from "./moderation-audio-reviewer";

async function reviewRecording(formData: FormData, nextStatus: RecordingStatus) {
  "use server";

  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;
  if (!session?.user || !isModeratorOrAbove(role)) {
    redirect("/");
  }

  const recordingId = String(formData.get("recordingId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!recordingId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.recording.update({
      where: { id: recordingId },
      data: {
        status: nextStatus,
        moderationNotes: reason || null,
        approvedAt: nextStatus === RecordingStatus.APPROVED ? new Date() : null,
        approvedByUserId: nextStatus === RecordingStatus.APPROVED ? session.user.id : null,
      },
    });

    await tx.moderationDecision.create({
      data: {
        recordingId,
        moderatorId: session.user.id,
        nextStatus,
        reason: reason || null,
      },
    });
  });

  revalidatePath("/moderation");
  revalidatePath("/");
}

async function approveAction(formData: FormData) {
  "use server";
  await reviewRecording(formData, RecordingStatus.APPROVED);
}

async function rejectAction(formData: FormData) {
  "use server";
  await reviewRecording(formData, RecordingStatus.REJECTED);
}

export default async function ModerationPage() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect("/signin?callbackUrl=/moderation");
  }

  if (!isModeratorOrAbove(role)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-6 shadow-[0_18px_40px_rgba(88,31,13,0.12)]">
          <h1 className="text-2xl font-bold text-orange-950">Moderator Access Required</h1>
          <p className="mt-2 text-sm text-orange-900/80">
            Your account is signed in as {role}. You need Moderator or Superuser role to review recordings.
          </p>
        </div>
      </main>
    );
  }

  const queue = await prisma.recording.findMany({
    where: { status: RecordingStatus.PENDING_APPROVAL },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true, email: true } },
      primaryPasuk: { select: { ref: true } },
      rangeStartPasuk: { select: { ref: true } },
      rangeEndPasuk: { select: { ref: true } },
      boundaries: {
        orderBy: { startMs: "asc" },
        select: {
          pasukId: true,
          startMs: true,
          endMs: true,
          pasuk: { select: { ref: true } },
        },
      },
    },
    take: 200,
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <header className="mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Moderation</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] md:text-4xl">Pending Recording Reviews</h1>
        </div>
      </header>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-6 text-sm text-orange-900/80">
          Queue is empty. No recordings are waiting for review.
        </div>
      ) : (
        <div className="grid gap-4">
          {queue.map((recording) => (
            <article key={recording.id} className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-orange-950">{recording.primaryPasuk.ref}</h2>
                  <p className="mt-1 text-sm text-orange-900/80">
                    Range: {recording.rangeStartPasuk.ref} to {recording.rangeEndPasuk.ref}
                  </p>
                  <p className="text-sm text-orange-900/80">
                    Submitted by {recording.user.name ?? recording.user.email ?? "Unknown user"}
                  </p>
                  <p className="text-sm text-orange-900/80">
                    {recording.title ? `Title: ${recording.title}` : "Untitled recording"}
                  </p>
                  <p className="text-sm text-orange-900/80">
                    Nussach: {recording.nussach}
                    {recording.nussachCustom ? ` (${recording.nussachCustom})` : ""}
                  </p>
                  <p className="text-sm text-orange-900/80">Duration: {recording.durationMs} ms</p>
                </div>
                <div className="rounded-xl bg-orange-100 px-3 py-2 text-xs font-bold text-orange-900">
                  {recording.boundaries.length} boundary markers
                </div>
              </div>

              <ModerationAudioReviewer
                boundaries={recording.boundaries.map((item) => ({
                  pasukId: item.pasukId,
                  pasukRef: item.pasuk.ref,
                  startMs: item.startMs,
                  endMs: item.endMs,
                }))}
                durationMs={recording.durationMs}
                publicUrl={recording.publicUrl}
              />

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <label className="text-sm font-semibold text-orange-950">
                  Moderator note (optional)
                  <input
                    className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2 text-sm"
                    form={`approve-${recording.id}`}
                    name="reason"
                    placeholder="Reason for decision"
                    type="text"
                  />
                </label>

                <form action={approveAction} id={`approve-${recording.id}`}>
                  <input name="recordingId" type="hidden" value={recording.id} />
                  <button className="w-full rounded-full bg-lime-600 px-4 py-2 text-sm font-bold text-white hover:bg-lime-700" type="submit">
                    Approve
                  </button>
                </form>

                <form action={rejectAction}>
                  <input name="recordingId" type="hidden" value={recording.id} />
                  <input name="reason" type="hidden" value="Rejected by moderator" />
                  <button className="w-full rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700" type="submit">
                    Reject
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
