import { prisma } from "@/lib/db/client";

export class AcceptInviteError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function acceptTeacherInviteForUser(input: { token: string; userId: string; userEmail?: string | null }) {
  const userEmail = input.userEmail?.trim().toLowerCase();
  if (!userEmail) {
    throw new AcceptInviteError("Your account must have an email address to accept invites.", 400);
  }

  const now = new Date();
  const invite = await prisma.teacherInvite.findUnique({
    where: { token: input.token },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invite) {
    throw new AcceptInviteError("Invite not found", 404);
  }

  if (invite.email.trim().toLowerCase() !== userEmail) {
    throw new AcceptInviteError("Invite email does not match your account.", 403);
  }

  if (invite.expiresAt < now) {
    throw new AcceptInviteError("Invite has expired", 410);
  }

  if (invite.acceptedAt && invite.acceptedByUserId && invite.acceptedByUserId !== input.userId) {
    throw new AcceptInviteError("Invite has already been accepted", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const acceptedInvite =
      invite.acceptedAt && invite.acceptedByUserId === input.userId
        ? invite
        : await tx.teacherInvite.update({
            where: { id: invite.id },
            data: {
              acceptedAt: now,
              acceptedByUserId: input.userId,
            },
          });

    const directLink = invite.groupId
      ? null
      : await tx.teacherStudentLink.upsert({
          where: {
            teacherId_studentId: {
              teacherId: invite.teacherId,
              studentId: input.userId,
            },
          },
          create: {
            teacherId: invite.teacherId,
            studentId: input.userId,
            inviteId: invite.id,
          },
          update: {
            inviteId: invite.id,
          },
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

    const enrollment = invite.groupId
      ? await tx.classEnrollment.upsert({
          where: {
            groupId_studentId: {
              groupId: invite.groupId,
              studentId: input.userId,
            },
          },
          create: {
            groupId: invite.groupId,
            studentId: input.userId,
          },
          update: {},
          include: {
            group: {
              select: {
                id: true,
                name: true,
                teacherId: true,
              },
            },
          },
        })
      : null;

    return {
      acceptedInvite,
      enrollment,
      directLink,
      invite,
    };
  });

  return result;
}
