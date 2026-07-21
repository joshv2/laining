import { z } from "zod";

import { auth } from "@/lib/auth";
import { consumeRateLimit, getRequestClientFingerprint } from "@/lib/services/abuse";
import { completeOnboardingWithInvite } from "@/lib/services/onboarding";

const onboardingSchema = z.object({
  inviteCode: z.string().trim().max(128).optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.status !== "onboarding") {
    return Response.json({ error: "This account is already verified." }, { status: 409 });
  }

  const rateLimitKey = `${session.user.email ?? session.user.id}:${getRequestClientFingerprint(request, session.user.id)}`;
  const rateLimit = consumeRateLimit(rateLimitKey, 5, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return Response.json({ error: "Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const parsed = onboardingSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await completeOnboardingWithInvite({
      inviteCode: parsed.data.inviteCode,
      email: session.user.email,
      image: session.user.image,
      name: session.user.name,
    });

    return Response.json({
      enrollment: result.enrollment,
      invite: result.acceptedInvite,
      role: result.user.role,
      userId: result.user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not complete onboarding.";
    const status = /not found/i.test(message)
      ? 404
      : /expired/i.test(message)
        ? 410
        : /match/i.test(message)
          ? 403
          : 400;

    return Response.json({ error: message }, { status });
  }
}