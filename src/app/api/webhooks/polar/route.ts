import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyPolarWebhook, WebhookVerificationError } from "@/lib/polar-webhook";
import { checkContentLength } from "@/lib/validation/common";
import { MAX_WEBHOOK_BODY_BYTES } from "@/constants/validation";
import { getBillingMode } from "@/lib/billing";
import type { BillingSubscriptionStatus } from "@/lib/billing";

// Polar uses the Standard Webhooks spec — every subscription-* event
// carries the full current Subscription object. We upsert it keyed on
// user_id from metadata, making the handler naturally idempotent.

function mapPolarStatus(polarStatus: string): BillingSubscriptionStatus {
  const mapping: Record<string, BillingSubscriptionStatus> = {
    active: "active",
    past_due: "past_due",
    canceled: "cancelled",
    unpaid: "unpaid",
    paused: "paused",
    trialing: "on_trial",
    incomplete: "none",
    incomplete_expired: "expired",
  };
  return mapping[polarStatus] ?? "none";
}

export async function POST(request: NextRequest) {
  if (getBillingMode() === "none") {
    return NextResponse.json({ status: "ignored", reason: "billing_disabled" });
  }

  const contentLength = checkContentLength(request, MAX_WEBHOOK_BODY_BYTES);
  if (!contentLength.success) {
    return NextResponse.json({ error: contentLength.error }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "Request payload is too large" }, { status: 413 });
  }

  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Failed to verify Polar webhook: POLAR_WEBHOOK_SECRET is not set");
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = verifyPolarWebhook(rawBody, headers, webhookSecret) as unknown as typeof event;
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }
    console.error("Failed to verify Polar webhook", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  // Only handle subscription events — all carry full subscription state.
  if (!event.type.startsWith("subscription.")) {
    return NextResponse.json({ status: "ignored" });
  }

  const sub = event.data as {
    id: string;
    status: string;
    productId: string;
    customerId: string;
    currentPeriodEnd: Date;
    endsAt: Date | null;
    metadata: Record<string, unknown>;
  };

  const userId = sub.metadata?.userId;
  if (!userId || typeof userId !== "string") {
    console.error("Polar webhook missing userId in subscription metadata", sub.id);
    return NextResponse.json({ status: "ignored" });
  }

  // Resolve plan from the subscription's productId. Hard-coding "team" would
  // grant team access for any product — verifying the product ID prevents a
  // future cheaper plan from accidentally unlocking team features.
  const teamProductId = process.env.POLAR_TEAM_PRODUCT_ID;
  const plan: "starter" | "team" =
    teamProductId && sub.productId === teamProductId ? "team" : "starter";

  if (plan === "starter") {
    console.warn(
      "Polar webhook received subscription with unknown productId",
      sub.id,
      sub.productId,
    );
  }

  const service = createServiceClient();
  const { error } = await service.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status: mapPolarStatus(sub.status),
      polar_customer_id: sub.customerId,
      polar_subscription_id: sub.id,
      renews_at: sub.currentPeriodEnd,
      ends_at: sub.endsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Failed to save billing subscription", userId, error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
