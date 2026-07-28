import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getStripeClient, isTeacherSubscriptionActive } from "@/lib/services/stripe";
import { syncTeacherAccessFromStripe } from "@/lib/services/teacher-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const callback = encodeURIComponent(url.pathname + url.search);
    return NextResponse.redirect(new URL(`/signin?callbackUrl=${callback}`, url.origin));
  }

  if (!sessionId) {
    return NextResponse.redirect(new URL("/teacher?checkout=missing-session", url.origin));
  }

  try {
    const stripe = getStripeClient();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const ownerId = checkoutSession.metadata?.userId?.trim() || checkoutSession.client_reference_id?.trim() || "";
    if (!ownerId || ownerId !== session.user.id) {
      return NextResponse.redirect(new URL("/teacher?checkout=forbidden", url.origin));
    }

    if (!checkoutSession.subscription) {
      return NextResponse.redirect(new URL("/teacher?checkout=subscription-missing", url.origin));
    }

    const subscription =
      typeof checkoutSession.subscription === "string"
        ? await stripe.subscriptions.retrieve(checkoutSession.subscription)
        : checkoutSession.subscription;

    await syncTeacherAccessFromStripe({
      userId: ownerId,
      customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
      subscriptionId: subscription.id,
      subscriptionActive: isTeacherSubscriptionActive(subscription.status),
      priceCents: subscription.items.data[0]?.price?.unit_amount ?? null,
      currencyCode: subscription.items.data[0]?.price?.currency?.toUpperCase() ?? subscription.currency?.toUpperCase() ?? "USD",
    });
    return NextResponse.redirect(new URL("/teacher?checkout=success", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/teacher?checkout=error", url.origin));
  }
}
