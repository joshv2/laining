import { z } from "zod";

import { auth } from "@/lib/auth";
import { AcceptInviteError, acceptTeacherInviteForUser } from "@/lib/services/teacher/invites";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = acceptInviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await acceptTeacherInviteForUser({
      token: parsed.data.token,
      userId: session.user.id,
      userEmail: session.user.email,
    });

    return Response.json({ invite: result.acceptedInvite, enrollment: result.enrollment });
  } catch (error) {
    if (error instanceof AcceptInviteError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json({ error: "Could not accept invite" }, { status: 500 });
  }
}
