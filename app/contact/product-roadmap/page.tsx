const roadmapItems = [
  "Waveform delineation of pesukim both on record and playback",
  "OCR/custom highlighting/custom delineation",
  "Trimming of silence",
  "Full student profile",
  "Ability for moderator to adjust slices",
  "Waveform analysis of practice",
  "Handle teacher payments",
  "Parshiyot/Double parshiyot",
  "Time of year context",
  "Options for Yamim Noraim tunes",
  "Moderation/up and down voting",
  "Hebrew version of site",
  "Learning programs/Assessments",
  "Pull in text without nikkud and taamim? Can they be removed with just CSS/JS",
  "Percentage of each book recorded overall/by nussah",
];

export default function ProductRoadmapPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12">
      <header className="mb-6">
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] md:text-4xl">Product Roadmap</h1>
        <p className="mt-3 text-sm text-orange-900/80">
          Current and upcoming ideas for Laining Collaborative. This list is public-facing and may evolve over time.
        </p>
      </header>

      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-6 shadow-[0_14px_36px_rgba(88,31,13,0.12)]">
        <ul className="space-y-3 text-sm leading-6 text-orange-950/90">
          {roadmapItems.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
