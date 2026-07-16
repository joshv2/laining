import { DiscountType, EntitlementSource, PurchaseStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/client";

export type CheckoutInput = {
  userId: string;
  recordingId: string;
  couponCode?: string;
};

export type CheckoutResult =
  | {
      status: "already-entitled";
      purchaseId: null;
      entitlementGranted: false;
      baseAmountCents: number;
      discountCents: number;
      finalAmountCents: number;
      requiresPayment: false;
      message: string;
    }
  | {
      status: "completed" | "pending-payment";
      purchaseId: string;
      entitlementGranted: boolean;
      baseAmountCents: number;
      discountCents: number;
      finalAmountCents: number;
      requiresPayment: boolean;
      message: string;
    };

function nowUtc(): Date {
  return new Date();
}

function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

function isCouponExpired(redeemBy: Date | null | undefined, when: Date): boolean {
  return Boolean(redeemBy && redeemBy.getTime() < when.getTime());
}

function computeDiscount(params: {
  discountType: DiscountType;
  percentOff: number | null;
  amountOffCents: number | null;
  baseAmountCents: number;
}): number {
  const { discountType, percentOff, amountOffCents, baseAmountCents } = params;

  if (baseAmountCents <= 0) {
    return 0;
  }

  if (discountType === DiscountType.PERCENT) {
    const percent = Math.min(100, Math.max(0, percentOff ?? 0));
    return Math.min(baseAmountCents, Math.floor((baseAmountCents * percent) / 100));
  }

  const amount = Math.max(0, amountOffCents ?? 0);
  return Math.min(baseAmountCents, amount);
}

async function resolveCoupon(tx: Prisma.TransactionClient, couponCode?: string) {
  if (!couponCode) {
    return null;
  }

  const code = normalizeCouponCode(couponCode);
  if (!code) {
    return null;
  }

  return tx.coupon.findUnique({
    where: { code },
    include: {
      _count: {
        select: {
          redemptions: true,
        },
      },
    },
  });
}

export async function checkoutRecordingAccess(input: CheckoutInput, db: PrismaClient = prisma): Promise<CheckoutResult> {
  const when = nowUtc();

  return db.$transaction(async (tx) => {
    const recording = await tx.recording.findUnique({
      where: { id: input.recordingId },
      select: {
        id: true,
        userId: true,
        paywallAsset: {
          select: {
            id: true,
            enabled: true,
            priceCents: true,
            currencyCode: true,
          },
        },
      },
    });

    if (!recording) {
      throw new Error("Recording not found");
    }

    if (recording.userId === input.userId) {
      return {
        status: "already-entitled",
        purchaseId: null,
        entitlementGranted: false,
        baseAmountCents: 0,
        discountCents: 0,
        finalAmountCents: 0,
        requiresPayment: false,
        message: "Owners always have access to their own recordings.",
      };
    }

    const asset = recording.paywallAsset;
    if (!asset?.enabled) {
      await tx.recordingEntitlement.upsert({
        where: {
          userId_recordingId: {
            userId: input.userId,
            recordingId: recording.id,
          },
        },
        create: {
          userId: input.userId,
          recordingId: recording.id,
          source: EntitlementSource.ADMIN_GRANT,
          metadata: {
            reason: "non-paywalled",
          },
        },
        update: {},
      });

      return {
        status: "completed",
        purchaseId: "",
        entitlementGranted: true,
        baseAmountCents: 0,
        discountCents: 0,
        finalAmountCents: 0,
        requiresPayment: false,
        message: "Recording is not paywalled.",
      };
    }

    const existingEntitlement = await tx.recordingEntitlement.findUnique({
      where: {
        userId_recordingId: {
          userId: input.userId,
          recordingId: recording.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingEntitlement) {
      return {
        status: "already-entitled",
        purchaseId: null,
        entitlementGranted: false,
        baseAmountCents: Math.max(0, asset.priceCents ?? 0),
        discountCents: 0,
        finalAmountCents: 0,
        requiresPayment: false,
        message: "You already have access to this recording.",
      };
    }

    const baseAmountCents = Math.max(0, asset.priceCents ?? 0);
    const coupon = await resolveCoupon(tx, input.couponCode);
    if (input.couponCode && !coupon) {
      throw new Error("Coupon code is invalid");
    }

    if (coupon && !coupon.active) {
      throw new Error("Coupon is not active");
    }

    if (coupon && isCouponExpired(coupon.redeemBy, when)) {
      throw new Error("Coupon is expired");
    }

    if (coupon && coupon.maxRedemptions !== null && coupon._count.redemptions >= coupon.maxRedemptions) {
      throw new Error("Coupon redemption limit reached");
    }

    const priorRedemption = coupon
      ? await tx.couponRedemption.findUnique({
          where: {
            couponId_userId: {
              couponId: coupon.id,
              userId: input.userId,
            },
          },
          select: { id: true },
        })
      : null;

    if (priorRedemption) {
      throw new Error("Coupon was already used by this account");
    }

    const discountCents = coupon
      ? computeDiscount({
          discountType: coupon.discountType,
          percentOff: coupon.percentOff,
          amountOffCents: coupon.amountOffCents,
          baseAmountCents,
        })
      : 0;

    const finalAmountCents = Math.max(0, baseAmountCents - discountCents);

    const purchase = await tx.recordingPurchase.create({
      data: {
        userId: input.userId,
        recordingId: recording.id,
        paywalledAssetId: asset.id,
        couponId: coupon?.id,
        currencyCode: asset.currencyCode ?? "USD",
        baseAmountCents,
        discountCents,
        finalAmountCents,
        status: finalAmountCents === 0 ? PurchaseStatus.COMPLETED : PurchaseStatus.PENDING,
        completedAt: finalAmountCents === 0 ? when : null,
      },
      select: {
        id: true,
      },
    });

    if (coupon) {
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId: input.userId,
          purchaseId: purchase.id,
        },
      });
    }

    if (finalAmountCents === 0) {
      await tx.recordingEntitlement.upsert({
        where: {
          userId_recordingId: {
            userId: input.userId,
            recordingId: recording.id,
          },
        },
        create: {
          userId: input.userId,
          recordingId: recording.id,
          purchaseId: purchase.id,
          source: coupon ? EntitlementSource.COUPON : EntitlementSource.PURCHASE,
          metadata: coupon
            ? {
                couponCode: coupon.code,
              }
            : undefined,
        },
        update: {
          purchaseId: purchase.id,
        },
      });

      return {
        status: "completed",
        purchaseId: purchase.id,
        entitlementGranted: true,
        baseAmountCents,
        discountCents,
        finalAmountCents,
        requiresPayment: false,
        message: coupon
          ? "Coupon applied successfully. Access granted."
          : "No payment needed. Access granted.",
      };
    }

    return {
      status: "pending-payment",
      purchaseId: purchase.id,
      entitlementGranted: false,
      baseAmountCents,
      discountCents,
      finalAmountCents,
      requiresPayment: true,
      message: "Payment processing is not yet implemented. Apply a full coupon or set a free price for now.",
    };
  });
}

export function normalizeCouponPayload(input: {
  code: string;
  discountType: DiscountType;
  percentOff?: number;
  amountOffCents?: number;
}) {
  const code = normalizeCouponCode(input.code);

  if (!code) {
    throw new Error("Coupon code is required");
  }

  if (input.discountType === DiscountType.PERCENT) {
    const percent = Math.trunc(input.percentOff ?? 0);
    if (percent <= 0 || percent > 100) {
      throw new Error("percentOff must be between 1 and 100");
    }

    return {
      code,
      percentOff: percent,
      amountOffCents: null,
    };
  }

  const amount = Math.trunc(input.amountOffCents ?? 0);
  if (amount <= 0) {
    throw new Error("amountOffCents must be greater than 0");
  }

  return {
    code,
    percentOff: null,
    amountOffCents: amount,
  };
}
