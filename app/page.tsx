import Link from "next/link";
import { Role } from "@prisma/client";

import { ActivateTeacherButton } from "@/app/teacher/activate-teacher-button";
import { auth } from "@/lib/auth";
import { isModeratorOrAbove, isSuperuser, isTeacher } from "@/lib/auth/roles";

const highlights = [
  "Pasuk-level seeking and full-portion playback",
  "Multiple recordings per pasuk with nussach labels",
  "Uploader-defined pasuk boundaries with moderation review",
  "Up/down voting with one vote per user per recording",
];

export default async function Home() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;
  const signedIn = Boolean(session?.user);

  return (
    <div className="grain relative flex min-h-screen flex-col overflow-hidden px-6 py-10 md:px-12">
      <div className="slide-in mx-auto w-full max-w-6xl rounded-3xl border border-orange-900/20 bg-[var(--surface)] p-8 shadow-[0_22px_60px_rgba(88,31,13,0.15)] md:p-12">
        <header className="mb-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-soft)]">Laining Collaborative</p>
            <p className="text-hebrew mt-2 text-lg text-[var(--ink-soft)]">לְלַמֵּד • לְהַקְלִיט • לִלְמֹד</p>
          </div>
        </header>

        <main className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-orange-900/15 bg-orange-100/60 p-4 text-sm text-orange-950">
              {signedIn ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">Signed in as {session?.user?.name ?? session?.user?.email}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold tracking-wide">Role: {role}</span>
                  <Link className="rounded-full bg-white px-3 py-1 text-xs font-bold hover:bg-orange-50" href="/learn">
                    Open Learner
                  </Link>
                  <Link className="rounded-full bg-white px-3 py-1 text-xs font-bold hover:bg-orange-50" href="/submit">
                    Submit New Recording
                  </Link>
                  {isTeacher(role) ? (
                    <Link className="rounded-full bg-white px-3 py-1 text-xs font-bold hover:bg-orange-50" href="/teacher">
                      Teacher Dashboard
                    </Link>
                  ) : null}
                  {isModeratorOrAbove(role) ? (
                    <Link className="rounded-full bg-white px-3 py-1 text-xs font-bold hover:bg-orange-50" href="/moderation">
                      Moderation Queue
                    </Link>
                  ) : null}
                  {isSuperuser(role) ? (
                    <Link className="rounded-full bg-white px-3 py-1 text-xs font-bold hover:bg-orange-50" href="/api/import/sefaria">
                      Sefaria Import API
                    </Link>
                  ) : null}
                </div>
              ) : (
                <span>
                  You are currently not signed in. Use Google sign-in to unlock submission, voting identity, and role-based tools.
                </span>
              )}
            </div>
            {signedIn && role === Role.USER ? (
              <div className="rounded-2xl border border-orange-900/15 bg-orange-50/70 p-4 text-sm text-orange-900/85">
                <p className="font-semibold text-orange-950">Teaching Bnei/Bnot Mitzvah?</p>
                <p className="mt-1">
                  Activate teacher mode to create classes, invite students, and assign recordings.
                </p>
                <div className="mt-3">
                  <ActivateTeacherButton />
                </div>
              </div>
            ) : null}
            <h1 className="text-4xl font-bold leading-tight text-[var(--foreground)] md:text-6xl">
              Learn every pasuk with real voices and collaborative precision.
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
              Record directly in the browser or upload existing chants, tag your nussach, and help others learn Torah,
              Neviim, and Ketuvim with verse-accurate navigation and guided moderation.
            </p>
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <span className="rounded-full bg-orange-100 px-4 py-2 text-orange-900">English + Hebrew</span>
              <span className="rounded-full bg-lime-100 px-4 py-2 text-lime-900">Google Auth + Roles</span>
              <span className="rounded-full bg-amber-100 px-4 py-2 text-amber-900">Sefaria-first Text Import</span>
            </div>
          </section>

          <aside className="rounded-2xl border border-orange-900/10 bg-orange-50/60 p-6">
            <h2 className="mb-4 text-xl font-bold text-orange-950">Current Implementation Slice</h2>
            <ul className="space-y-3 text-sm text-orange-900">
              {highlights.map((item) => (
                <li key={item} className="rounded-xl bg-white/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </main>
      </div>
    </div>
  );
}
