import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeText(input) {
  if (!input) return "";
  const merged = Array.isArray(input) ? input.join(" ") : String(input);
  return merged.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchSefariaText(ref) {
  const url = `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0&commentary=0&vhe=${encodeURIComponent("Tanach with Ta'amei Hamikra")}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Sefaria request failed (${response.status}) for ${ref}`);
  }

  const payload = await response.json();
  return {
    hebrewText: normalizeText(payload.he),
    englishText: normalizeText(payload.text) || null,
  };
}

async function main() {
  const pesukim = await prisma.pasuk.findMany({
    select: {
      id: true,
      ref: true,
    },
    orderBy: [
      { chapter: { number: "asc" } },
      { number: "asc" },
    ],
  });

  let updated = 0;

  for (const pasuk of pesukim) {
    try {
      const text = await fetchSefariaText(pasuk.ref);
      if (!text.hebrewText) {
        console.warn(`Skipping ${pasuk.ref}: empty Hebrew text.`);
        continue;
      }

      await prisma.pasuk.update({
        where: { id: pasuk.id },
        data: {
          hebrewText: text.hebrewText,
          englishText: text.englishText,
        },
      });

      updated += 1;
      console.log(`Updated ${pasuk.ref}`);
    } catch (error) {
      console.error(`Failed ${pasuk.ref}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`Completed. Updated ${updated}/${pesukim.length} pesukim with taamim text.`);
}

main()
  .catch((error) => {
    console.error("Refresh failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
