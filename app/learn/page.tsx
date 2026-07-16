import { LearnerWorkbench } from "./learner-workbench";

export default function LearnPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <header className="mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Learn</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] md:text-4xl">Pasuk-based Listening and Practice</h1>
        </div>
      </header>

      <LearnerWorkbench />
    </main>
  );
}
