import { prisma } from "@/lib/db/client";

type CompleteOnboardingInput = {
  inviteCode?: string | null;
  email: string | null | undefined;
  name?: string | null;
  image?: string | null;
};

export class OnboardingError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function completeOnboardingWithInvite(input: CompleteOnboardingInput) {
  const email = input.email?.trim().toLowerCase();
  if (!email) {
    throw new OnboardingError("Your Google account must include an email address.", 400);
  }

  const now = new Date();
  const inviteCode = input.inviteCode?.trim();

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      image: input.image ?? null,
      name: input.name?.trim() || email,
    },
    update: {
      image: input.image ?? undefined,
      name: input.name?.trim() || undefined,
    },
  });

  if (!inviteCode) {
    return {
      acceptedInvite: null,
      directLink: null,
      enrollment: null,
      invite: null,
      user,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const invite = await tx.teacherInvite.findUnique({
      where: { token: inviteCode },
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
      throw new OnboardingError("Invite not found.", 404);
    }

    if (invite.email.trim().toLowerCase() !== email) {
      throw new OnboardingError("Invite email does not match your Google account.", 403);
    }

    if (invite.expiresAt < now) {
      throw new OnboardingError("Invite has expired.", 410);
    }

    if (invite.acceptedAt && invite.acceptedByUserId && invite.acceptedByUserId !== user.id) {
      throw new OnboardingError("Invite has already been accepted by another account.", 409);
    }

    const acceptedInvite =
      invite.acceptedAt && invite.acceptedByUserId === user.id
        ? invite
        : await tx.teacherInvite.update({
            where: { id: invite.id },
            data: {
              acceptedAt: now,
              acceptedByUserId: user.id,
            },
          });

    const directLink = invite.groupId
      ? null
      : await tx.teacherStudentLink.upsert({
          where: {
            teacherId_studentId: {
              teacherId: invite.teacherId,
              studentId: user.id,
            },
          },
          create: {
            teacherId: invite.teacherId,
            studentId: user.id,
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
              studentId: user.id,
            },
          },
          create: {
            groupId: invite.groupId,
            studentId: user.id,
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
      directLink,
      enrollment,
      invite,
      user,
    };
  });

  return result;
}