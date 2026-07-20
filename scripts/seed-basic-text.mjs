import { PrismaClient, WorkType } from "@prisma/client";

const prisma = new PrismaClient();

const seedData = {
  works: [
    {
      slug: "torah",
      titleEn: "Torah",
      titleHe: "תורה",
      order: 1,
      kind: WorkType.TORAH,
    },
    {
      slug: "prophets",
      titleEn: "Neviim",
      titleHe: "נביאים",
      order: 2,
      kind: WorkType.NEVIIM,
    },
    {
      slug: "writings",
      titleEn: "Ketuvim",
      titleHe: "כתובים",
      order: 3,
      kind: WorkType.KETUVIM,
    }
  ],
};

async function upsertPasuk(chapterId, pasuk) {
  await prisma.pasuk.upsert({
    where: { ref: pasuk.ref },
    update: {
      number: pasuk.number,
      hebrewText: pasuk.hebrewText,
      englishText: pasuk.englishText,
      chapterId,
    },
    create: {
      chapterId,
      number: pasuk.number,
      ref: pasuk.ref,
      hebrewText: pasuk.hebrewText,
      englishText: pasuk.englishText,
    },
  });
}

async function main() {
  for (const workInput of seedData.works) {
    const work = await prisma.work.upsert({
      where: { slug: workInput.slug },
      update: {
        titleEn: workInput.titleEn,
        titleHe: workInput.titleHe,
        order: workInput.order,
        kind: workInput.kind,
      },
      create: {
        slug: workInput.slug,
        titleEn: workInput.titleEn,
        titleHe: workInput.titleHe,
        order: workInput.order,
        kind: workInput.kind,
      },
    });

  }

  console.log("Seed complete: basic Torah text loaded.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
