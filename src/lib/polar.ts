import "server-only";
import { Polar } from "@polar-sh/sdk";
import { getBillingMode } from "@/lib/billing";
import { BILLING_MODE } from "@/constants/billing";

function polarClient(): Polar {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "POLAR_ACCESS_TOKEN is not set. Get it from Polar dashboard → Settings → API.",
    );
  }
  const server = getBillingMode() === BILLING_MODE.TEST ? "sandbox" : "production";
  return new Polar({ accessToken, server });
}

/** Creates a Polar checkout session and returns its hosted checkout URL. Throws on a non-OK response. */
export async function createPolarCheckout({
  userId,
  email,
  redirectUrl,
}: {
  userId: string;
  email: string;
  redirectUrl: string;
}): Promise<string> {
  const polar = polarClient();
  const productId = process.env.POLAR_TEAM_PRODUCT_ID;
  if (!productId) {
    throw new Error("POLAR_TEAM_PRODUCT_ID is not set.");
  }

  const checkout = await polar.checkouts.create({
    products: [productId],
    customerEmail: email,
    successUrl: redirectUrl,
    metadata: { userId },
  });

  if (!checkout.url) {
    throw new Error("Polar checkout response missing URL");
  }

  return checkout.url;
}

/**
 * Creates a Polar customer portal session for an existing customer.
 * Returns the customer portal URL where the user can manage their subscription.
 */
export async function createPolarCustomerPortal(customerId: string): Promise<string> {
  const polar = polarClient();
  const session = await polar.customerSessions.create({ customerId });
  return session.customerPortalUrl;
}
