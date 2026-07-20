import { z } from "zod";
import { prisma } from "@/lib/db/client";

const sefariaTextSchema = z.object({
  ref: z.string().optional(),
  error: z.string().optional(),
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
  const merged = Array.isArray(input) ? input.join(" ").trim() : input.trim();
  return merged.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function toSefariaRef(ref: string): string {
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

export async function fetchSefariaPasuk(ref: string): Promise<SefariaText> {
  const sefariaRef = toSefariaRef(ref);
  const url = `https://www.sefaria.org/api/texts/${encodeURIComponent(sefariaRef)}?context=0&commentary=0&vhe=${encodeURIComponent("Tanach with Ta'amei Hamikra")}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Sefaria request failed: ${response.status}`);
  }

  const parsed = sefariaTextSchema.parse(await response.json());
  if (parsed.error) {
    throw new Error(`Sefaria request failed for ${sefariaRef}: ${parsed.error}`);
  }

  return {
    ref: parsed.ref ?? sefariaRef,
    hebrewText: normalizeText(parsed.he),
    englishText: normalizeText(parsed.text),
  };
}

export async function ensurePasukTextLoaded(pasuk: { id: string; ref: string; hebrewText: string | null }): Promise<{ id: string; ref: string; hebrewText: string | null }> {
  // If text is already loaded, return as-is
  if (pasuk.hebrewText && pasuk.hebrewText.trim()) {
    return pasuk;
  }

  // Fetch from Sefaria
  try {
    const sefariaText = await fetchSefariaPasuk(pasuk.ref);

    // Update database
    await prisma.pasuk.update({
      where: { id: pasuk.id },
      data: {
        hebrewText: sefariaText.hebrewText || null,
        englishText: sefariaText.englishText || null,
      },
    });

    return {
      ...pasuk,
      hebrewText: sefariaText.hebrewText,
    };
  } catch (error) {
    // Log error but return original pasuk with null text
    console.error(`Failed to fetch text for ${pasuk.ref}:`, error);
    return pasuk;
  }
}
