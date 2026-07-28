import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { cancelStripeSubscriptionNow, isStripeSecretConfigured } from "@/lib/services/stripe";
import { deactivateTeacherAccess } from "@/lib/services/teacher-access";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscription = await prisma.teacherAccessSubscription?.findUnique({
      where: {
        userId: session.user.id,
      },
      select: {
        source: true,
        externalSubscriptionId: true,
      },
    });

    if (subscription?.source === "STRIPE" && subscription.externalSubscriptionId) {
      if (!isStripeSecretConfigured()) {
        return Response.json(
          {
            error:
              "Stripe cancellation is not configured on this environment. Add STRIPE_SECRET_KEY or cancel the subscription in Stripe first.",
          },
          { status: 500 },
        );
      }

      await cancelStripeSubscriptionNow(subscription.externalSubscriptionId);
    }

    const result = await deactivateTeacherAccess({
      userId: session.user.id,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not deactivate teacher mode.";
    return Response.json({ error: message }, { status: 400 });
  }
}
