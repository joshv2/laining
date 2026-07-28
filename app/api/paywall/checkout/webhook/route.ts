import Stripe from "stripe";

import { prisma } from "@/lib/db/client";
import {
  getStripeClient,
  getStripeWebhookSecret,
  isStripeWebhookConfigured,
  isTeacherSubscriptionActive,
} from "@/lib/services/stripe";
import { syncTeacherAccessFromStripe } from "@/lib/services/teacher-access";

export const runtime = "nodejs";

function resolveUserIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const userIdFromMetadata = subscription.metadata?.userId?.trim();
  if (userIdFromMetadata) {
    return userIdFromMetadata;
  }

  return null;
}

async function syncFromSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = resolveUserIdFromSubscription(subscription);
  const directSubscriptionId = subscription.id;

  let targetUserId = userId;
  if (!targetUserId) {
    const local = await prisma.teacherAccessSubscription.findFirst({
      where: {
        externalSubscriptionId: directSubscriptionId,
      },
      select: {
        userId: true,
      },
    });
    targetUserId = local?.userId ?? null;
  }

  if (!targetUserId) {
    return;
  }

  const firstItem = subscription.items.data[0];
  const unitAmount = firstItem?.price?.unit_amount ?? null;
  const currencyCode = firstItem?.price?.currency?.toUpperCase() ?? subscription.currency?.toUpperCase() ?? "USD";

  await syncTeacherAccessFromStripe({
    userId: targetUserId,
    customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    subscriptionId: subscription.id,
    subscriptionActive: isTeacherSubscriptionActive(subscription.status),
    priceCents: unitAmount,
    currencyCode,
  });
}

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook signature.";
    return Response.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId?.trim() || session.client_reference_id?.trim() || null;
      if (!userId || !session.subscription) {
        break;
      }

      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
      await syncTeacherAccessFromStripe({
        userId,
        customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
        subscriptionId: subscription.id,
        subscriptionActive: isTeacherSubscriptionActive(subscription.status),
        priceCents: subscription.items.data[0]?.price?.unit_amount ?? null,
        currencyCode: subscription.items.data[0]?.price?.currency?.toUpperCase() ?? subscription.currency?.toUpperCase() ?? "USD",
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncFromSubscription(subscription);
      break;
    }
    default:
      break;
  }

  return Response.json({ received: true });
}
