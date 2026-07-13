import { PrismaClient, WorkType } from "@prisma/client";

const prisma = new PrismaClient();

const seedData = {
  works: [
    {
      slug: "torah",
      titleEn: "Torah",
      titleHe: "תורה",
      kind: WorkType.TORAH,
      books: [
        {
          slug: "genesis",
          titleEn: "Genesis",
          titleHe: "בראשית",
          chapters: [
            {
              number: 1,
              pesukim: [
                {
                  number: 1,
                  ref: "Genesis 1:1",
                  hebrewText: "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ",
                  englishText: "In the beginning God created the heavens and the earth.",
                },
                {
                  number: 2,
                  ref: "Genesis 1:2",
                  hebrewText: "וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל פְּנֵי תְהוֹם",
                  englishText: "The earth was unformed and void, with darkness over the surface of the deep.",
                },
                {
                  number: 3,
                  ref: "Genesis 1:3",
                  hebrewText: "וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי אוֹר",
                  englishText: "God said, Let there be light, and there was light.",
                },
              ],
            },
            {
              number: 2,
              pesukim: [
                {
                  number: 1,
                  ref: "Genesis 2:1",
                  hebrewText: "וַיְכֻלּוּ הַשָּׁמַיִם וְהָאָרֶץ וְכָל צְבָאָם",
                  englishText: "The heavens and the earth were finished, and all their array.",
                },
                {
                  number: 2,
                  ref: "Genesis 2:2",
                  hebrewText: "וַיְכַל אֱלֹהִים בַּיּוֹם הַשְּׁבִיעִי מְלַאכְתּוֹ אֲשֶׁר עָשָׂה",
                  englishText: "On the seventh day God finished the work that had been undertaken.",
                },
              ],
            },
          ],
        },
      ],
    },
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
        kind: workInput.kind,
      },
      create: {
        slug: workInput.slug,
        titleEn: workInput.titleEn,
        titleHe: workInput.titleHe,
        kind: workInput.kind,
      },
    });

    for (const bookInput of workInput.books) {
      const book = await prisma.book.upsert({
        where: {
          workId_slug: {
            workId: work.id,
            slug: bookInput.slug,
          },
        },
        update: {
          titleEn: bookInput.titleEn,
          titleHe: bookInput.titleHe,
        },
        create: {
          workId: work.id,
          slug: bookInput.slug,
          titleEn: bookInput.titleEn,
          titleHe: bookInput.titleHe,
        },
      });

      for (const chapterInput of bookInput.chapters) {
        const chapter = await prisma.chapter.upsert({
          where: {
            bookId_number: {
              bookId: book.id,
              number: chapterInput.number,
            },
          },
          update: {},
          create: {
            bookId: book.id,
            number: chapterInput.number,
          },
        });

        for (const pasukInput of chapterInput.pesukim) {
          await upsertPasuk(chapter.id, pasukInput);
        }
      }
    }
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
