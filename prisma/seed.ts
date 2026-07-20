import path from 'path';
import dotenv from 'dotenv';

// 1. Load the local development environment variables first
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

import { PrismaClient, WorkType } from '@prisma/client';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

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


const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

// 2. Map the CSV category IDs to the exact SLUGS currently in your database
const workSlugMap: Record<string, string> = {
  'cmrokiuhp0000f3hw2ua261dx': 'torah',     
  'cmrokiuhp0000f3hw2ua261dy': 'prophets',  // <- Change to 'neviim' if that's your DB slug
  'cmrokiuhp0000f3hw2ua261dz': 'writings',  // <- Change to 'ketuvim' if that's your DB slug
};

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

  
  
  const csvFilePath = path.resolve(process.cwd(), 'books2.csv');
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
  });

  records.shift(); // Remove headers row
  const nextBookOrderByWork = new Map<string, number>();
  const bookOrderByKey = new Map<string, number>();

  console.log(`🚀 Starting optimized database seed from flattened CSV...`);

  for (const row of records) {
    const csvWorkId = row[0].trim(); 
    const bookEn = row[1].trim();
    const bookHe = row[2].trim();
    
    // Updated indices accounting for the inserted 'order' column at Column D (index 3)
    const bookOrder = parseInt(row[3], 10) || 1;
    const chapterNumber = parseInt(row[4], 10);
    const verseCountVal = row[5]; // Chapter_Value is now at index 6 (Column G)

    if (isNaN(chapterNumber) || !verseCountVal || verseCountVal.trim() === '') continue;

    const totalVerses = Math.floor(parseFloat(verseCountVal));
    if (isNaN(totalVerses) || totalVerses <= 0) continue;

    const bookSlug = slugify(bookEn);
    const targetWorkSlug = workSlugMap[csvWorkId] || slugify(csvWorkId);

    // Look up the parent Work category in Postgres
    const workExists = await prisma.work.findUnique({
      where: { slug: targetWorkSlug }
    });

    if (!workExists) {
      console.error(`❌ Error: Could not find Work category '${targetWorkSlug}' in database.`);
      process.exit(1);
    }

    const actualWorkId = workExists.id; 

    // Upsert the Book, now setting the 'order' column
    const createdBook = await prisma.book.upsert({
      where: {
        workId_slug: {
          workId: actualWorkId,
          slug: bookSlug,
        },
      },
      update: {
        order: bookOrder,
      },
      create: {
        workId: actualWorkId,
        slug: bookSlug,
        titleEn: bookEn,
        titleHe: bookHe,
        order: bookOrder,
      },
    });

    const generatedBookId = createdBook.id;

    console.log(`📖 Processing ${bookEn} (Order ${bookOrder}) - Chapter ${chapterNumber}`);

    // Upsert the Chapter
    const createdChapter = await prisma.chapter.upsert({
      where: {
        bookId_number: {
          bookId: generatedBookId,
          number: chapterNumber,
        },
      },
      update: {},
      create: {
        bookId: generatedBookId,
        number: chapterNumber,
      },
    });

    const generatedChapterId = createdChapter.id;

    // Create Pasuk placeholders
    const pesukimData = Array.from({ length: totalVerses }, (_, index) => {
      const pasukNumber = index + 1;
      return {
        chapterId: generatedChapterId,
        number: pasukNumber,
        ref: `${bookSlug}-${chapterNumber}-${pasukNumber}`,
        hebrewText: null,
        englishText: null,
      };
    });

    // Bulk insert pasukim
    await prisma.pasuk.createMany({
      data: pesukimData,
      skipDuplicates: true,
    });
  }

  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });