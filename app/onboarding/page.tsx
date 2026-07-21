import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin?callbackUrl=/onboarding");
  }

  if (session.user.status === "active") {
    redirect("/learn");
  }

  const role = (session.user.role ?? Role.USER) as Role;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-12">
      <section className="w-full rounded-[2rem] border border-orange-900/20 bg-[var(--surface)] p-8 shadow-[0_18px_48px_rgba(88,31,13,0.14)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-soft)]">Verify your account</p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--foreground)]">Finish Google sign-in</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-orange-900/80">
          You are signed in as {session.user.name ?? session.user.email ?? "this account"}. Leave the invite code blank to create a public account, or paste the invite code your teacher sent to join a class.
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-orange-900/75">
          <span className="rounded-full bg-orange-100 px-3 py-1">Session status: onboarding</span>
          <span className="rounded-full bg-orange-100 px-3 py-1">Role preview: {role}</span>
        </div>

        <OnboardingForm />
      </section>
    </main>
  );
}