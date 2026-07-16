import { z } from "zod";

import { auth } from "@/lib/auth";
import { activateTeacherAccess } from "@/lib/services/teacher-access";

const activateTeacherSchema = z.object({
  couponCode: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = activateTeacherSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await activateTeacherAccess({
      userId: session.user.id,
      couponCode: parsed.data.couponCode,
    });

    return Response.json({ ok: true, role: result.role, message: result.message, accessSource: result.accessSource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not activate teacher mode.";
    const status = /paid/i.test(message) ? 402 : 400;
    return Response.json({ error: message }, { status });
  }
}
