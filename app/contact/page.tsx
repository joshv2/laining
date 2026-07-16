import { auth } from "@/lib/auth";

import { ContactForm } from "./contact-form";

export default async function ContactPage() {
  const session = await auth();

  return (
    <div className="grain min-h-screen px-6 py-10 md:px-12">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-orange-900/20 bg-[var(--surface)] p-8 shadow-[0_20px_48px_rgba(88,31,13,0.14)]">
        <h1 className="text-3xl font-bold text-orange-950 md:text-4xl">Contact The Team</h1>
        <p className="mt-3 text-sm text-orange-900/80">
          Send questions, bug reports, or moderation concerns. Messages are routed to the superuser notification channel.
        </p>

        <div className="mt-6">
          <ContactForm defaultEmail={session?.user?.email ?? ""} defaultName={session?.user?.name ?? ""} />
        </div>
      </div>
    </div>
  );
}
