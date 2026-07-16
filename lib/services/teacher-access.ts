import { Role, TeacherAccessSource, TeacherAccessStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/client";

type TeacherAccessDelegate = {
  findUnique(args: {
    where: { userId: string };
    select: {
      id: true;
      status: true;
      source: true;
      externalSubscriptionId: true;
    };
  }): Promise<{
    id: string;
    status: TeacherAccessStatus;
    source: TeacherAccessSource;
    externalSubscriptionId: string | null;
  } | null>;
  upsert(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
};

function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

function isCouponExpired(redeemBy: Date | null | undefined, when: Date): boolean {
  return Boolean(redeemBy && redeemBy.getTime() < when.getTime());
}

export function teacherFeaturePriceCents(): number {
  const raw = process.env.TEACHER_FEATURE_PRICE_CENTS?.trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
}

export type ActivateTeacherInput = {
  userId: string;
  couponCode?: string;
};

export type ActivateTeacherResult = {
  role: Role;
  accessSource: "free" | "coupon";
  message: string;
};

export type DeactivateTeacherResult = {
  role: Role;
  subscriptionStatus: TeacherAccessStatus;
  message: string;
};

export async function activateTeacherAccess(input: ActivateTeacherInput, db: PrismaClient = prisma): Promise<ActivateTeacherResult> {
  const now = new Date();
  const requiredPrice = teacherFeaturePriceCents();

  return db.$transaction(async (tx) => {
    const teacherAccessDelegate = (tx as unknown as { teacherAccessSubscription?: TeacherAccessDelegate }).teacherAccessSubscription;

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.role === Role.TEACHER) {
      return {
        role: Role.TEACHER,
        accessSource: "free",
        message: "Teacher mode is already active.",
      };
    }

    if (user.role !== Role.USER) {
      throw new Error("This account role cannot self-activate teacher mode.");
    }

    if (requiredPrice <= 0) {
      if (teacherAccessDelegate) {
        await teacherAccessDelegate.upsert({
          where: {
            userId: user.id,
          },
          create: {
            userId: user.id,
            status: TeacherAccessStatus.ACTIVE,
            source: TeacherAccessSource.FREE,
            priceCents: 0,
            currencyCode: "USD",
            activatedAt: now,
            deactivatedAt: null,
          },
          update: {
            status: TeacherAccessStatus.ACTIVE,
            source: TeacherAccessSource.FREE,
            priceCents: 0,
            currencyCode: "USD",
            activatedAt: now,
            deactivatedAt: null,
            couponId: null,
            externalCustomerId: null,
            externalSubscriptionId: null,
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { role: Role.TEACHER },
      });

      return {
        role: Role.TEACHER,
        accessSource: "free",
        message: "Teacher mode activated.",
      };
    }

    const normalizedCouponCode = normalizeCouponCode(input.couponCode ?? "");
    if (!normalizedCouponCode) {
      throw new Error("Teacher access is paid. Provide a valid coupon code until payment checkout is enabled.");
    }

    const coupon = await tx.coupon.findUnique({
      where: {
        code: normalizedCouponCode,
      },
      include: {
        _count: {
          select: {
            redemptions: true,
          },
        },
      },
    });

    if (!coupon) {
      throw new Error("Coupon code is invalid.");
    }

    if (!coupon.active) {
      throw new Error("Coupon is not active.");
    }

    if (isCouponExpired(coupon.redeemBy, now)) {
      throw new Error("Coupon is expired.");
    }

    if (coupon.maxRedemptions !== null && coupon._count.redemptions >= coupon.maxRedemptions) {
      throw new Error("Coupon redemption limit reached.");
    }

    const existingRedemption = await tx.couponRedemption.findUnique({
      where: {
        couponId_userId: {
          couponId: coupon.id,
          userId: user.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingRedemption) {
      throw new Error("This coupon was already used by this account.");
    }

    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userId: user.id,
      },
    });

    if (teacherAccessDelegate) {
      await teacherAccessDelegate.upsert({
        where: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          status: TeacherAccessStatus.ACTIVE,
          source: TeacherAccessSource.COUPON,
          priceCents: requiredPrice,
          currencyCode: "USD",
          couponId: coupon.id,
          activatedAt: now,
          deactivatedAt: null,
        },
        update: {
          status: TeacherAccessStatus.ACTIVE,
          source: TeacherAccessSource.COUPON,
          priceCents: requiredPrice,
          currencyCode: "USD",
          couponId: coupon.id,
          activatedAt: now,
          deactivatedAt: null,
        },
      });
    }

    await tx.user.update({
      where: { id: user.id },
      data: { role: Role.TEACHER },
    });

    return {
      role: Role.TEACHER,
      accessSource: "coupon",
      message: "Teacher mode activated with coupon.",
    };
  });
}

export type DeactivateTeacherInput = {
  userId: string;
};

export async function deactivateTeacherAccess(input: DeactivateTeacherInput, db: PrismaClient = prisma): Promise<DeactivateTeacherResult> {
  const now = new Date();

  return db.$transaction(async (tx) => {
    const teacherAccessDelegate = (tx as unknown as { teacherAccessSubscription?: TeacherAccessDelegate }).teacherAccessSubscription;

    const user = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.role !== Role.TEACHER) {
      throw new Error("Teacher mode is not active on this account.");
    }

    const subscription = teacherAccessDelegate
      ? await teacherAccessDelegate.findUnique({
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            status: true,
            source: true,
            externalSubscriptionId: true,
          },
        })
      : null;

    if (subscription?.source === TeacherAccessSource.STRIPE && subscription.externalSubscriptionId) {
      // Stripe cancellation can be wired here once Stripe subscription billing is enabled.
      // Keeping the role downgrade and local subscription status in sync now avoids orphaned access.
    }

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        role: Role.USER,
      },
    });

    if (teacherAccessDelegate) {
      if (subscription) {
        await teacherAccessDelegate.update({
          where: {
            id: subscription.id,
          },
          data: {
            status: TeacherAccessStatus.CANCELED,
            deactivatedAt: now,
          },
        });
      } else {
        await teacherAccessDelegate.create({
          data: {
            userId: user.id,
            status: TeacherAccessStatus.CANCELED,
            source: TeacherAccessSource.FREE,
            priceCents: 0,
            currencyCode: "USD",
            activatedAt: now,
            deactivatedAt: now,
          },
        });
      }
    }

    return {
      role: Role.USER,
      subscriptionStatus: TeacherAccessStatus.CANCELED,
      message: "Teacher mode deactivated. Billing state is now marked as canceled.",
    };
  });
}
