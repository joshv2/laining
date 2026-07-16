import { DiscountType, Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { isSuperuser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";
import { normalizeCouponPayload } from "@/lib/services/paywall";

const createCouponSchema = z.object({
  code: z.string().min(2).max(40),
  description: z.string().max(280).optional(),
  discountType: z.nativeEnum(DiscountType),
  percentOff: z.number().int().min(1).max(100).optional(),
  amountOffCents: z.number().int().min(1).max(1_000_000).optional(),
  maxRedemptions: z.number().int().min(1).max(1_000_000).optional(),
  redeemBy: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;
  if (!session?.user || !isSuperuser(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const coupons = await prisma.coupon.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          redemptions: true,
          purchases: true,
        },
      },
    },
    take: 200,
  });

  return Response.json({ coupons });
}

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;
  if (!session?.user || !isSuperuser(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createCouponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  let normalized;
  try {
    normalized = normalizeCouponPayload({
      code: payload.code,
      discountType: payload.discountType,
      percentOff: payload.percentOff,
      amountOffCents: payload.amountOffCents,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid coupon payload" }, { status: 400 });
  }

  const redeemBy = payload.redeemBy ? new Date(payload.redeemBy) : null;
  if (redeemBy && Number.isNaN(redeemBy.getTime())) {
    return Response.json({ error: "Invalid redeemBy date" }, { status: 400 });
  }

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: normalized.code,
        description: payload.description,
        discountType: payload.discountType,
        percentOff: normalized.percentOff,
        amountOffCents: normalized.amountOffCents,
        maxRedemptions: payload.maxRedemptions,
        redeemBy,
        active: payload.active ?? true,
        createdByUserId: session.user.id,
      },
    });

    return Response.json({ coupon }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /Unique constraint failed/.test(error.message)) {
      return Response.json({ error: "Coupon code already exists" }, { status: 409 });
    }

    throw error;
  }
}
