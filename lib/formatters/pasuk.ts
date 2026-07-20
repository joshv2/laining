export function formatPasukRef(ref: string): string {
  if (!ref) {
    return "";
  }

  const match = ref.match(/^(.*)-(\d+)-(\d+)$/);
  if (!match) {
    return ref;
  }

  const [, bookSlug, chapter, pasuk] = match;
  const smallWords = new Set(["and", "of", "the", "a", "an", "in", "on", "to"]);
  const book = bookSlug
    .split("-")
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index > 0 && smallWords.has(lower)) {
        return lower;
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");

  return `${book} ${chapter}:${pasuk}`;
}