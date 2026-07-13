import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentRole = (session.user.role ?? Role.USER) as Role;

  if (currentRole === Role.TEACHER) {
    return Response.json({ ok: true, role: Role.TEACHER });
  }

  if (currentRole !== Role.USER) {
    return Response.json(
      { error: "This account role cannot self-activate teacher mode." },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { role: Role.TEACHER },
    select: {
      id: true,
      role: true,
    },
  });

  return Response.json({ ok: true, user });
}
