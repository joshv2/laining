import path from 'path';
import dotenv from 'dotenv';

// 1. Load your local development environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// List of the 12 Minor Prophets slugs matching your DB slugs
const minorProphetsSlugs = [
  'hosea', 'joel', 'amos', 'obadiah', 'jonah', 
  'micah', 'nahum', 'habakkuk', 'zephaniah', 
  'haggai', 'zechariah', 'malachi'
];

async function main() {
  console.log('🧹 Starting database correction for Minor Prophets...');

  for (const slug of minorProphetsSlugs) {
    // 1. Find the Book record to grab its generated ID
    const book = await prisma.book.findFirst({
      where: { slug: slug }
    });

    if (!book) {
      console.log(`⚠️ Book with slug '${slug}' not found in DB. Skipping...`);
      continue;
    }

    console.log(`\n📖 Fixing Book: ${book.titleEn} (ID: ${book.id})`);

    // 2. Delete the incorrect Chapter 1
    // (Because onDelete: Cascade is configured in your schema, this instantly wipes its bad pesukim)
    const deletedChapter = await prisma.chapter.deleteMany({
      where: {
        bookId: book.id,
        number: 1
      }
    });
    
    if (deletedChapter.count > 0) {
      console.log(`❌ Deleted incorrect Chapter 1`);
    }

    // 3. Fetch the remaining chapters sorted ascending (2, 3, 4...)
    const chapters = await prisma.chapter.findMany({
      where: { bookId: book.id },
      orderBy: { number: 'asc' }
    });

    // 4. Shift each chapter number down by 1
    for (const chapter of chapters) {
      const oldNumber = chapter.number;
      const newNumber = oldNumber - 1;

      console.log(`🔄 Shifting Chapter ${oldNumber} ➡️ Chapter ${newNumber}`);

      // Update the Chapter number
      await prisma.chapter.update({
        where: { id: chapter.id },
        data: { number: newNumber }
      });

      // 5. Update the unique text reference string inside the Pasuk table for this chapter
      // So 'hosea-2-1' properly becomes 'hosea-1-1'
      const pesukim = await prisma.pasuk.findMany({
        where: { chapterId: chapter.id }
      });

      for (const pasuk of pesukim) {
        const newRef = `${slug}-${newNumber}-${pasuk.number}`;
        await prisma.pasuk.update({
          where: { id: pasuk.id },
          data: { ref: newRef }
        });
      }
    }
  }

  console.log('\n✅ Database cleanup completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });