import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { isSuperuser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;
  if (!session?.user || !isSuperuser(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const recipientId = url.searchParams.get("recipientId") ?? undefined;

  const entries = await prisma.tokenLedgerEntry.findMany({
    where: recipientId ? { recipientId } : undefined,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      recipient: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    take: 250,
  });

  return Response.json({ entries });
}
