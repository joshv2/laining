import { z } from "zod";

const sefariaTextSchema = z.object({
  ref: z.string(),
  he: z.union([z.string(), z.array(z.string())]).optional(),
  text: z.union([z.string(), z.array(z.string())]).optional(),
});

export type SefariaText = {
  ref: string;
  hebrewText: string;
  englishText: string;
};

function normalizeText(input: string | string[] | undefined): string {
  if (!input) return "";
  return Array.isArray(input) ? input.join(" ").trim() : input.trim();
}

export async function fetchSefariaPasuk(ref: string): Promise<SefariaText> {
  const url = `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0&commentary=0`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Sefaria request failed: ${response.status}`);
  }

  const parsed = sefariaTextSchema.parse(await response.json());

  return {
    ref: parsed.ref,
    hebrewText: normalizeText(parsed.he),
    englishText: normalizeText(parsed.text),
  };
}
