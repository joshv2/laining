import Stripe from "stripe";

import { teacherFeaturePriceCents } from "@/lib/services/teacher-access";

const apiVersion: Stripe.LatestApiVersion = "2026-06-24.dahlia";

let stripeClient: Stripe | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function isStripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeCheckoutConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_TEACHER_PRICE_ID?.trim());
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
      apiVersion,
    });
  }

  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  return requiredEnv("STRIPE_WEBHOOK_SECRET");
}

function resolveAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const authUrl = process.env.NEXTAUTH_URL?.trim();
  if (authUrl) {
    return authUrl.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const withProtocol = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    return withProtocol.replace(/\/$/, "");
  }

  throw new Error("Set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL so Stripe can build success and cancel URLs.");
}

export type CreateTeacherCheckoutSessionInput = {
  userId: string;
  userEmail?: string | null;
  callbackBaseUrl?: string;
  couponCode?: string;
};

async function resolvePromotionCodeId(couponCode: string, stripe: Stripe): Promise<string> {
  const normalizedCode = couponCode.trim();
  if (!normalizedCode) {
    throw new Error("Coupon code is invalid.");
  }

  const promotionCodes = await stripe.promotionCodes.list({
    code: normalizedCode,
    active: true,
    limit: 5,
  });

  const promotionCode =
    promotionCodes.data.find((item) => item.code?.toLowerCase() === normalizedCode.toLowerCase()) ?? promotionCodes.data[0] ?? null;

  if (!promotionCode) {
    throw new Error("Coupon code is invalid or inactive in Stripe.");
  }

  return promotionCode.id;
}

export async function createTeacherCheckoutSession(input: CreateTeacherCheckoutSessionInput): Promise<{ url: string; id: string }> {
  if (!isStripeCheckoutConfigured()) {
    throw new Error("Stripe checkout is not configured. Set STRIPE_SECRET_KEY and STRIPE_TEACHER_PRICE_ID.");
  }

  const stripe = getStripeClient();
  const baseUrl = (input.callbackBaseUrl?.trim() || resolveAppBaseUrl()).replace(/\/$/, "");
  const normalizedCouponCode = input.couponCode?.trim() || "";
  const promotionCodeId = normalizedCouponCode ? await resolvePromotionCodeId(normalizedCouponCode, stripe) : null;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: requiredEnv("STRIPE_TEACHER_PRICE_ID"),
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/api/paywall/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/teacher?checkout=cancel`,
    client_reference_id: input.userId,
    customer_email: input.userEmail ?? undefined,
    metadata: {
      userId: input.userId,
      feature: "teacher",
    },
    subscription_data: {
      metadata: {
        userId: input.userId,
        feature: "teacher",
      },
    },
    allow_promotion_codes: !promotionCodeId,
    discounts: promotionCodeId
      ? [
          {
            promotion_code: promotionCodeId,
          },
        ]
      : undefined,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return {
    url: session.url,
    id: session.id,
  };
}

export function hasPaidTeacherFeatureEnabled(): boolean {
  return teacherFeaturePriceCents() > 0;
}

export function isTeacherSubscriptionActive(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

export async function cancelStripeSubscriptionNow(subscriptionId: string): Promise<void> {
  if (!isStripeSecretConfigured()) {
    throw new Error("Stripe is not configured on the server.");
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
    return;
  }

  await stripe.subscriptions.cancel(subscriptionId);
}
