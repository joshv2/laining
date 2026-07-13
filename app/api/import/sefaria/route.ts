import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { fetchSefariaPasuk } from "@/lib/services/text-catalog";

const importRequestSchema = z.object({
  ref: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.SUPERUSER) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = importRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const text = await fetchSefariaPasuk(parsed.data.ref);
    return Response.json({ source: "sefaria", text });
  } catch (error) {
    return Response.json(
      {
        error: "Unable to fetch from Sefaria",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
