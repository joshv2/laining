"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  priceCents: number;
};

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceCents / 100);
}

export function ActivateTeacherButton({ priceCents }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleActivate() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/paywall/checkout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            couponCode: couponCode.trim() || undefined,
          }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error ?? "Could not activate teacher mode.");
        }

        const checkoutUrl = data?.checkout?.checkoutUrl;
        const pendingPayment = data?.checkout?.status === "pending-payment";
        if (pendingPayment && typeof checkoutUrl === "string" && checkoutUrl) {
          window.location.assign(checkoutUrl);
          return;
        }

        setSuccess(data?.checkout?.message ?? data.message ?? "Teacher mode activated.");
        router.refresh();
        router.push("/teacher");
      } catch (activateError) {
        setError(activateError instanceof Error ? activateError.message : "Could not activate teacher mode.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-orange-900/70">
        Teacher access starts at {formatPrice(priceCents)} per month.
      </p>
      <label className="block text-xs font-semibold uppercase tracking-wider text-orange-900/75">
        Coupon Code (Optional)
        <input
          className="mt-1 w-full rounded-full border border-orange-900/20 bg-white px-3 py-2 text-sm font-medium text-orange-950"
          onChange={(event) => setCouponCode(event.target.value)}
          placeholder="TEACHER2026"
          value={couponCode}
        />
      </label>
      <button
        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        onClick={handleActivate}
        type="button"
      >
        {isPending ? "Working..." : couponCode.trim() ? "Activate With Coupon" : `Subscribe for ${formatPrice(priceCents)}/month`}
      </button>
      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="text-xs font-semibold text-lime-700">{success}</p> : null}
    </div>
  );
}
