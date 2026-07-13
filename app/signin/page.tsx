import Link from "next/link";

import { GoogleSignInButton } from "./google-signin-button";

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const callbackUrl = params?.callbackUrl && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
      <section className="rounded-3xl border border-orange-900/20 bg-white/70 p-8 shadow-[0_14px_34px_rgba(89,33,13,0.14)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-800">Laining Collaborative</p>
        <h1 className="mt-4 text-3xl font-bold text-orange-950">Sign in with Google</h1>
        <p className="mt-3 text-sm leading-6 text-orange-900/80">
          Accounts are role-based: learners, moderators, and superusers. Public recordings are approved by moderators before publishing.
        </p>

        <GoogleSignInButton callbackUrl={callbackUrl} />

        <Link className="mt-6 inline-block text-sm font-semibold text-orange-900 underline-offset-4 hover:underline" href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}
