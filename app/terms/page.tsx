export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Legal</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] md:text-4xl">Terms of Use</h1>
      </header>

      <section className="space-y-4 rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-6 text-sm leading-6 text-orange-950/90 shadow-[0_14px_36px_rgba(88,31,13,0.12)]">
        <p>
          By using Laining Collaborative, you agree to use the platform respectfully and lawfully, including when uploading
          recordings or sharing invite links.
        </p>
        <p>
          You are responsible for the content you upload. Do not upload content you do not have rights to use.
        </p>
        <p>
          Website source code is licensed under MIT. Uploaded recordings and derived playback assets remain property of the site.
        </p>
        <p>
          Moderator and teacher tools are intended for educational use. We may suspend access for misuse, abuse, or attempts to
          bypass access controls.
        </p>
        <p>
          These terms may be updated over time. Continued use after updates means you accept the revised terms.
        </p>
        <p className="font-semibold">Questions? Contact the site team before using classroom features with external students.</p>
      </section>

    </main>
  );
}
