import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { notifySuperusersOfContactSubmission } from "@/lib/services/notifications";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(240),
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(10).max(5000),
  contextUrl: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  const parsed = contactSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const message = await prisma.contactMessage.create({
    data: {
      userId: session?.user?.id ?? null,
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      contextUrl: parsed.data.contextUrl,
    },
  });

  await notifySuperusersOfContactSubmission({
    contactMessageId: message.id,
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    contextUrl: message.contextUrl,
  });

  return Response.json({ ok: true, messageId: message.id }, { status: 201 });
}
