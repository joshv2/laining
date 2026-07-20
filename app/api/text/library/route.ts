import { prisma } from "@/lib/db/client";

export async function GET() {
  const works = await prisma.work.findMany({
    orderBy: [{ order: "asc" }, { titleEn: "asc" }],
    include: {
      books: {
        orderBy: [{ order: "asc" }, { titleEn: "asc" }],
        include: {
          chapters: {
            orderBy: { number: "asc" },
            select: {
              id: true,
              number: true,
              _count: { select: { pesukim: true } },
            },
          },
        },
      },
    },
  });

  return Response.json({ works });
}
