import { NotificationChannel, NotificationEventType, Role } from "@prisma/client";

import { prisma } from "@/lib/db/client";

export type ContactNotificationInput = {
  contactMessageId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  contextUrl?: string | null;
};

export async function notifySuperusersOfContactSubmission(input: ContactNotificationInput) {
  const excerpt = input.message.trim().slice(0, 220);

  await prisma.superuserNotification.create({
    data: {
      channel: NotificationChannel.IN_APP,
      eventType: NotificationEventType.CONTACT_SUBMISSION,
      title: `New contact message: ${input.subject}`,
      body: `${input.name} (${input.email}) submitted a new message. ${excerpt}`,
      payload: {
        contactMessageId: input.contactMessageId,
        contextUrl: input.contextUrl ?? null,
      },
    },
  });
}

export async function listSuperuserNotifications(limit = 100) {
  return prisma.superuserNotification.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: Math.min(Math.max(limit, 1), 200),
  });
}

export async function countUnreadSuperuserNotifications() {
  return prisma.superuserNotification.count({
    where: {
      readAt: null,
    },
  });
}

export function canAccessSuperuserNotifications(role: Role | null | undefined): boolean {
  return role === Role.SUPERUSER;
}
