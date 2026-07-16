import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { canAccessSuperuserNotifications } from "@/lib/services/notifications";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(_: Request, context: RouteContext) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user || !canAccessSuperuserNotifications(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { notificationId } = await context.params;

  const notification = await prisma.superuserNotification.findUnique({
    where: {
      id: notificationId,
    },
    select: {
      id: true,
    },
  });

  if (!notification) {
    return Response.json({ error: "Notification not found" }, { status: 404 });
  }

  const updated = await prisma.superuserNotification.update({
    where: {
      id: notification.id,
    },
    data: {
      readAt: new Date(),
    },
  });

  return Response.json({ notification: updated });
}
