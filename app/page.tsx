import Link from "next/link";
import { Role } from "@prisma/client";

import { ActivateTeacherButton } from "@/app/teacher/activate-teacher-button";
import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";
import { teacherFeaturePriceCents } from "@/lib/services/teacher-access";

const teacherOutcomes = [
  "Create classes, invite students, and assign exact pesukim for practice",
  "Track assignment engagement through real playback activity",
  "Guide students with instructions, due dates, and verse-accurate recordings",
  "Keep families aligned with a clear, structured practice workflow",
];

const archiveOutcomes = [
  "Pasuk-level playback across Torah, Neviim, and Ketuvim",
  "Multiple recordings per pasuk with nussach labels",
  "Uploader-defined pasuk boundaries reviewed in moderation",
  "Community voting to surface reliable learning recordings",
];

type PathwayCard = {
  icon: "learn" | "teach" | "contribute";
  title: string;
  description: string;
  href: string;
  cta: string;
};

const pathwayCards: PathwayCard[] = [
  {
    icon: "learn",
    title: "Learn",
    description: "Find verse-accurate recordings and practice line by line with real voices.",
    href: "/learn",
    cta: "Open Learner Library",
  },
  {
    icon: "teach",
    title: "Teach",
    description: "Manage Bar/Bat Mitzvah students, assign practice, and track progress.",
    href: "/teacher",
    cta: "Open Teacher Dashboard",
  },
  {
    icon: "contribute",
    title: "Contribute",
    description: "Upload recordings and strengthen a living cantillation archive for every tradition.",
    href: "/submit",
    cta: "Submit a Recording",
  },
];

function PathwayIcon({ icon }: { icon: "learn" | "teach" | "contribute" }) {
  if (icon === "learn") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6.75C4 5.78 4.78 5 5.75 5h9.5c.97 0 1.75.78 1.75 1.75v10.5c0 .97-.78 1.75-1.75 1.75h-9.5A1.75 1.75 0 0 1 4 17.25V6.75Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7.5 9h6.5M7.5 12h6.5M7.5 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        <path d="M17 7.5h1.25c.97 0 1.75.78 1.75 1.75v8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    );
  }

  if (icon === "teach") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 8.5 12 4l8.5 4.5L12 13 3.5 8.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
        <path d="M7 10.5v4.25C7 16.55 9.24 18 12 18s5-1.45 5-3.25V10.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        <path d="M20.5 9.5v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.6" width="15" x="4" y="8" />
      <path d="M9 8V6.75C9 5.78 9.78 5 10.75 5h1.5C13.22 5 14 5.78 14 6.75V8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 12h15" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 14.5h1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export default async function Home() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;
  const signedIn = Boolean(session?.user);
  const teacherPriceCents = teacherFeaturePriceCents();

  return (
    <div className="grain relative flex min-h-screen flex-col overflow-hidden px-6 py-10 md:px-12">
      <div className="slide-in mx-auto w-full max-w-6xl rounded-3xl border border-orange-900/20 bg-[var(--surface)] p-8 shadow-[0_22px_60px_rgba(88,31,13,0.15)] md:p-12">
        <header className="mb-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-soft)]">Laining Lab</p>
            <p className="text-hebrew mt-2 text-lg text-[var(--ink-soft)]">לְלַמֵּד • לְהַקְלִיט • לִלְמֹד</p>
          </div>
        </header>

        <main>
          <section className="space-y-6">
            <h1 className="text-3xl font-bold leading-tight text-[var(--foreground)] md:text-5xl">
              Teach Bar/Bat Mitzvah students with confidence. Preserve every tradition in one living cantillation
              archive.
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
              Laining Lab combines two essential tools: a teacher workspace for assigning and tracking student practice,
              and a growing archive of cantillation recordings across Torah, Neviim, and Ketuvim for diverse nussach
              traditions.
            </p>
            {!signedIn ? (
              <div className="flex justify-center">
                <Link
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
                  href="/signin"
                >
                  Start Teaching with Laining Lab
                </Link>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <span className="rounded-full bg-orange-100 px-4 py-2 text-orange-900">Teacher Assignments + Progress Tracking</span>
              <span className="rounded-full bg-lime-100 px-4 py-2 text-lime-900">Bible-Wide Cantillation Archive</span>
              <span className="rounded-full bg-amber-100 px-4 py-2 text-amber-900">Multi-Tradition Nussach Recordings</span>
            </div>

            {signedIn && role === Role.USER ? (
              <div className="rounded-2xl border border-orange-900/15 bg-orange-50/70 p-4 text-sm text-orange-900/85">
                <p className="font-semibold text-orange-950">Teaching Bnei/Bnot Mitzvah?</p>
                <p className="mt-1">
                  Activate teacher mode to create classes, invite students, and assign recordings.
                </p>
                <div className="mt-3">
                  <ActivateTeacherButton priceCents={teacherPriceCents} />
                </div>
              </div>
            ) : null}
          </section>
        </main>
      </div>

      <section className="mx-auto mt-8 w-full max-w-6xl space-y-8">
        <div className="grid gap-5 md:grid-cols-3">
          {pathwayCards.map((card) => (
            <div key={card.title} className="rounded-3xl border border-orange-900/15 bg-[var(--surface)] p-6 shadow-[0_10px_28px_rgba(88,31,13,0.08)]">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-900">
                <PathwayIcon icon={card.icon} />
              </div>
              <p className="mt-4 text-xl font-bold text-orange-950">{card.title}</p>
              <p className="mt-2 text-base leading-relaxed text-orange-950/90">{card.description}</p>
              <Link
                className="mt-5 inline-flex rounded-full border border-orange-900/20 px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100"
                href={card.href}
              >
                {card.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-orange-900/15 bg-[var(--surface)] p-6 shadow-[0_10px_28px_rgba(88,31,13,0.08)] md:p-8">
          <h2 className="text-2xl font-bold text-orange-950">Why It Matters</h2>
          <p className="mt-3 max-w-5xl text-sm leading-relaxed text-orange-900/90 md:text-base">
            Cantillation learning should not depend on fragmented recordings, guesswork, or last-minute teacher follow-up.
            Laining Lab helps educators teach with structure while preserving diverse chanting traditions for the next
            generation.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ul className="space-y-2 text-sm text-orange-900">
              {teacherOutcomes.map((item) => (
                <li key={item} className="rounded-xl bg-white/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
            <ul className="space-y-2 text-sm text-orange-900">
              {archiveOutcomes.map((item) => (
                <li key={item} className="rounded-xl bg-white/70 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
