import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/client";
import { ensurePasukTextLoaded } from "@/lib/services/text-catalog";

const ensureLoadedRequestSchema = z.object({
  pasukId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ensureLoadedRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const pasuk = await prisma.pasuk.findUnique({
      where: { id: parsed.data.pasukId },
      select: { id: true, ref: true, hebrewText: true },
    });

    if (!pasuk) {
      return Response.json({ error: "Pasuk not found" }, { status: 404 });
    }

    const updated = await ensurePasukTextLoaded(pasuk);
    return Response.json({ pasuk: updated });
  } catch (error) {
    console.error("ensure-loaded error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
