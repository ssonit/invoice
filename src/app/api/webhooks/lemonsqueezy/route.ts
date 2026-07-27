import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy-webhook";
import { checkContentLength } from "@/lib/validation/common";
import { MAX_WEBHOOK_BODY_BYTES } from "@/constants/validation";
import {
  parseLemonSqueezyWebhook,
  parseWebhookJson,
} from "@/lib/validation/webhooks";

export async function POST(request: NextRequest) {
  const contentLength = checkContentLength(request, MAX_WEBHOOK_BODY_BYTES);
  if (!contentLength.success) {
    return NextResponse.json({ error: contentLength.error }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "Request payload is too large" }, { status: 413 });
  }

  const signature = request.headers.get("x-signature");

  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Failed to verify Lemon Squeezy webhook: LEMONSQUEEZY_WEBHOOK_SECRET is not set");
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const json = parseWebhookJson(rawBody);
  if (!json.success) {
    return NextResponse.json({ error: json.error }, { status: 400 });
  }

  const parsed = parseLemonSqueezyWebhook(json.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const event = parsed.data;

  if (!event.meta.event_name.startsWith("subscription_")) {
    return NextResponse.json({ status: "ignored" });
  }

  const userId = event.meta.custom_data?.user_id;
  if (!userId) {
    // Unmappable event (missing/stale custom_data) — ack so Lemon Squeezy
    // doesn't retry an event we can never apply, but log for investigation.
    console.error("Lemon Squeezy webhook missing user_id in custom_data", event.data.id);
    return NextResponse.json({ status: "ignored" });
  }

  const service = createServiceClient();
  const { error } = await service.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      plan: "team",
      status: event.data.attributes.status,
      ls_customer_id: String(event.data.attributes.customer_id),
      ls_subscription_id: event.data.id,
      customer_portal_url: event.data.attributes.urls.customer_portal,
      renews_at: event.data.attributes.renews_at,
      ends_at: event.data.attributes.ends_at,
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
