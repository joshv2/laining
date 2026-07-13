import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { SubmitRecordingForm } from "./submit-recording-form";

export default async function SubmitPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin?callbackUrl=/submit");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Submit Recording</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] md:text-4xl">Upload and Mark Pasuk Boundaries</h1>
        </div>
        <Link className="rounded-full border border-orange-900/25 px-4 py-2 text-sm font-semibold hover:bg-orange-100" href="/">
          Back Home
        </Link>
      </div>

      <SubmitRecordingForm />
    </main>
  );
}
