import { Role, TokenizationEventType } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { isSuperuser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";

const updateRuleSchema = z.object({
  eventType: z.nativeEnum(TokenizationEventType),
  tokenDelta: z.number().int().min(-1000).max(1000).optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;
  if (!session?.user || !isSuperuser(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const rules = await prisma.tokenizationRule.findMany({
    orderBy: {
      eventType: "asc",
    },
  });

  return Response.json({ rules });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;
  if (!session?.user || !isSuperuser(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateRuleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const current = await prisma.tokenizationRule.findUnique({
    where: {
      eventType: parsed.data.eventType,
    },
  });

  const rule = current
    ? await prisma.tokenizationRule.update({
        where: {
          eventType: parsed.data.eventType,
        },
        data: {
          ...(parsed.data.tokenDelta !== undefined ? { tokenDelta: parsed.data.tokenDelta } : {}),
          ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
        },
      })
    : await prisma.tokenizationRule.create({
        data: {
          eventType: parsed.data.eventType,
          tokenDelta: parsed.data.tokenDelta ?? 0,
          enabled: parsed.data.enabled ?? true,
        },
      });

  return Response.json({ rule });
}
