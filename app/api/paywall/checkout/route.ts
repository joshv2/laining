import { Role } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { createTeacherCheckoutSession, hasPaidTeacherFeatureEnabled } from "@/lib/services/stripe";
import { activateTeacherAccess, teacherFeaturePriceCents } from "@/lib/services/teacher-access";

const checkoutSchema = z.object({
  couponCode: z.string().trim().max(40).optional(),
});

export const runtime = "nodejs";

function resolveRequestOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const couponCode = parsed.data.couponCode?.trim() || undefined;

  if (!hasPaidTeacherFeatureEnabled()) {
    try {
      const result = await activateTeacherAccess({
        userId: session.user.id,
      });

      return Response.json({
        checkout: {
          status: "completed",
          feature: "teacher",
          role: result.role,
          accessSource: result.accessSource,
          requiresPayment: false,
          message: result.message,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      return Response.json({ error: message }, { status: 400 });
    }
  }

  if ((session.user.role as Role | undefined) === Role.TEACHER) {
    return Response.json({
      checkout: {
        status: "completed",
        feature: "teacher",
        requiresPayment: false,
        message: "Teacher mode is already active.",
      },
    });
  }

  try {
    const checkoutSession = await createTeacherCheckoutSession({
      userId: session.user.id,
      userEmail: session.user.email,
      callbackBaseUrl: resolveRequestOrigin(request),
      couponCode,
    });

    return Response.json({
      checkout: {
        status: "pending-payment",
        feature: "teacher",
        requiresPayment: true,
        amountCents: teacherFeaturePriceCents(),
        checkoutSessionId: checkoutSession.id,
        checkoutUrl: checkoutSession.url,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    return Response.json(
      {
        error: message,
        checkout: {
          status: "failed",
          feature: "teacher",
          requiresPayment: true,
        },
      },
      { status: 400 },
    );
  }
}
