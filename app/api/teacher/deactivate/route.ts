import { auth } from "@/lib/auth";
import { deactivateTeacherAccess } from "@/lib/services/teacher-access";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await deactivateTeacherAccess({
      userId: session.user.id,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not deactivate teacher mode.";
    return Response.json({ error: message }, { status: 400 });
  }
}
