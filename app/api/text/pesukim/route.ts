import { prisma } from "@/lib/db/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chapterId = url.searchParams.get("chapterId");
  const bookId = url.searchParams.get("bookId");

  if (!chapterId && !bookId) {
    return Response.json({ error: "bookId or chapterId is required" }, { status: 400 });
  }

  const pesukim = await prisma.pasuk.findMany({
    where: chapterId
      ? { chapterId }
      : {
          chapter: {
            bookId: bookId ?? undefined,
          },
        },
    orderBy: chapterId ? { number: "asc" } : [{ chapter: { number: "asc" } }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      ref: true,
      hebrewText: true,
      englishText: true,
      chapter: {
        select: {
          id: true,
          number: true,
        },
      },
    },
  });

  return Response.json({
    pesukim: pesukim.map((pasuk) => ({
      id: pasuk.id,
      number: pasuk.number,
      ref: pasuk.ref,
      hebrewText: pasuk.hebrewText,
      englishText: pasuk.englishText,
      chapterId: pasuk.chapter.id,
      chapterNumber: pasuk.chapter.number,
    })),
  });
}
