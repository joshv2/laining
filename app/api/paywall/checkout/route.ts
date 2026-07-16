import { z } from "zod";

import { auth } from "@/lib/auth";
import { activateTeacherAccess, teacherFeaturePriceCents } from "@/lib/services/teacher-access";

const checkoutSchema = z.object({
  couponCode: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await activateTeacherAccess({
      userId: session.user.id,
      couponCode: parsed.data.couponCode,
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
    const requiresPayment = teacherFeaturePriceCents() > 0 && /paid/i.test(message);
    return Response.json(
      {
        error: message,
        checkout: {
          status: "pending-payment",
          feature: "teacher",
          requiresPayment,
        },
      },
      { status: requiresPayment ? 402 : 400 },
    );
  }
}
