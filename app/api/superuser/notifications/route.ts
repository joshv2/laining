import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { canAccessSuperuserNotifications, listSuperuserNotifications } from "@/lib/services/notifications";

export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user || !canAccessSuperuserNotifications(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const notifications = await listSuperuserNotifications(Number.isFinite(limitParam) ? limitParam : 50);

  return Response.json({ notifications });
}
