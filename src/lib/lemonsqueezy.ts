import "server-only";

// Thin wrapper around Lemon Squeezy's JSON:API checkout endpoint — no SDK
// dependency, this is the only call this app makes against their API.
export async function createLemonSqueezyCheckout({
  userId,
  email,
  redirectUrl,
}: {
  userId: string;
  email: string;
  redirectUrl: string;
}): Promise<string> {
  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email,
            custom: { user_id: userId },
          },
          product_options: {
            redirect_url: redirectUrl,
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: process.env.LEMONSQUEEZY_STORE_ID },
          },
          variant: {
            data: { type: "variants", id: process.env.LEMONSQUEEZY_TEAM_VARIANT_ID },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Lemon Squeezy checkout request failed: ${response.status}`);
  }

  const json = (await response.json()) as { data: { attributes: { url: string } } };
  return json.data.attributes.url;
}
