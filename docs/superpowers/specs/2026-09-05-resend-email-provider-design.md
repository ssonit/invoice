# Resend as a Swappable Email Provider — Design

**Date:** 2026-09-05
**Status:** Approved for implementation
**Plan:** [`../plans/2026-09-05-resend-email-provider.md`](../plans/2026-09-05-resend-email-provider.md)

## Problem

`src/lib/agentmail.ts` hardcodes AgentMail as the one email backend. Two costs follow.

**Money.** AgentMail's binding constraint is *inbox count*, not email volume: 3 inboxes free,
10 on the $20 Developer plan, 150 on the $200 Startup plan. This product provisions one
inbox per customer, so **customer #11 forces a 10x jump to $200/mo**. There is no tier
between $20 and $200. See [`docs/third-party-services.md`](../../third-party-services.md).

**Coupling.** `agentmail` is imported directly by two Trigger.dev tasks and one Server
Action, which violates the swappable-backend rule in `.claude/rules/code-style.md`
(a runtime-selected provider goes through a dispatch table, never inline at the call site).

Resend prices inbound by volume, not by mailbox: **$0 up to 3,000 emails/mo, $20 for
50,000**. Its receiving domain `<id>.resend.app` is catch-all, so addresses are unlimited
and need no provisioning call at all.

## Non-goals

- **Not** OAuth-per-customer (Resend or AgentMail). Investigated and rejected: Resend
  access tokens live 900s and refresh tokens rotate on every use, so concurrent
  Trigger.dev tasks refreshing the same grant would clobber each other's refresh token and
  silently kill the connection. It also requires customers to hold their own Resend
  account, which they do not.
- **Not** Gmail/Microsoft OAuth ("the Cal.com model"). A real future option, but it changes
  the product from "forward to this address" to "scan your mailbox", and Gmail read scopes
  require an annual CASA assessment ($500–$4,500+). The dispatch table introduced here is
  what makes adding it later cheap.
- **Not** removing AgentMail. It stays fully working and is the default until Resend is
  verified in production.

## Approach

### 1. Two webhook routes, not one branching route

The existing `/api/webhooks/agentmail` route is **left untouched**. A new
`/api/webhooks/resend` route is added. Provider identity comes from *which URL the vendor
posts to*, so no runtime dispatch is needed in the request path and the working AgentMail
flow carries zero regression risk.

Both routes normalize to the **existing** `ProcessInboundEmailPayload` shape (plus the new
reply-context fields), so everything downstream — `process-inbound-email`,
`process-attachment`, extraction, quota, reply — keeps its current structure.

### 2. Resend's webhook carries no body — the route fetches it

AgentMail's `message.received` includes `text`/`html`. Resend's `email.received` carries
only metadata:

```json
{ "type": "email.received", "data": {
    "email_id": "...", "from": "...", "to": ["..."], "message_id": "<...@...>",
    "subject": "...",
    "attachments": [{ "id": "...", "filename": "...", "content_type": "...",
                      "content_disposition": "...", "content_id": "..." }] } }
```

So the Resend route calls `resend.emails.receiving.get(email_id)` to obtain `text`/`html`
and the attachment `size` field — absent from the webhook payload but required by
`shouldExtractAttachment`'s decorative-image check in
`src/lib/extraction/document-gate.ts`.

**Tradeoff accepted:** one extra API call inside the webhook request. The alternative —
fetching inside the task — would force an equivalent `messages.get` call into the
AgentMail path too, changing behavior for existing customers. Not worth it.

### 3. Per-inbox provider, not a global switch

A global `EMAIL_PROVIDER` env var cannot express "existing customers on AgentMail, new ones
on Resend" during a gradual rollout. So:

- `EMAIL_PROVIDER` (env) decides which provider **new** addresses are provisioned with.
- `inboxes.provider` (column) decides which adapter services an **existing** address.

### 4. Routing key becomes provider-neutral

AgentMail routes by `inboxId`; Resend has no inbox concept and routes by the **recipient
address**. Both collapse into one column, `inboxes.provider_inbox_id`:

| Provider | `provider_inbox_id` | Source in the webhook |
|---|---|---|
| agentmail | AgentMail `inbox_id` | `message.inboxId` |
| resend | the email address itself | `data.to[]` / `data.received_for[]` |

### 5. Reply needs more context under Resend

AgentMail threads with `messages.reply(inboxId, messageId, { text })`. Resend has no reply
primitive — you send a new email carrying an `In-Reply-To` header:

```ts
resend.emails.send({
  from: theUsersForwardingAddress,
  to: [originalSender],
  subject: `Re: ${subject}`,
  text,
  headers: { "In-Reply-To": rfcMessageId },
});
```

So the reply payload gains `fromAddress`, `toAddress`, `subject`, and `rfcMessageId`.
AgentMail's adapter ignores the new fields; Resend's requires them.

## Schema changes

Additive only, per `.claude/rules/data-safety.md` — no column is dropped and no row is
deleted. `agentmail_inbox_id` merely loses its NOT NULL, which is a constraint loosening,
not data loss.

```sql
alter table public.inboxes add column provider text not null default 'agentmail';
alter table public.inboxes add column provider_inbox_id text;
update public.inboxes set provider_inbox_id = agentmail_inbox_id where provider_inbox_id is null;
alter table public.inboxes alter column agentmail_inbox_id drop not null;
alter table public.inboxes add constraint inboxes_provider_check check (provider in ('agentmail','resend'));
create index inboxes_provider_inbox_id_idx on public.inboxes (provider_inbox_id);
```

Retiring `agentmail_inbox_id` is deliberately left as a later cleanup, once no rows use it.

## File structure

| File | Responsibility |
|---|---|
| `src/constants/email.ts` | `EMAIL_PROVIDER` ids + `RESEND_ATTACHMENT_*` limits |
| `src/lib/email/types.ts` | Provider-neutral types shared by both adapters |
| `src/lib/email/address.ts` | Pure address helpers — unit tested |
| `src/lib/email/normalize-resend.ts` | Pure: Resend webhook + fetched content → normalized email — unit tested |
| `src/lib/email/agentmail.ts` | AgentMail adapter (existing `src/lib/agentmail.ts` moves here) |
| `src/lib/email/resend.ts` | Resend adapter |
| `src/lib/email/index.ts` | Dispatch table + `provisionAddress` / `fetchAttachment` / `sendReply` |
| `src/app/api/webhooks/resend/route.ts` | New route: verify (svix) → fetch content → enqueue |
| `supabase/migrations/*_inbox_provider.sql` | Schema above |

Unit tests cover `address.ts`, `normalize-resend.ts`, and the env schema. Adapters, the
route, and the tasks are **not** unit tested — matching the existing convention in
`.claude/rules/testing.md` for thin SDK wrappers, API routes, and `src/trigger/*`.

## Verification

Manual, against local Supabase + `npx trigger.dev@latest dev`:

1. `EMAIL_PROVIDER=agentmail` — provision an inbox, forward a PDF invoice, confirm it
   extracts and auto-replies exactly as before. **This is the regression gate.**
2. `EMAIL_PROVIDER=resend` — provision, forward the same invoice to the `@<id>.resend.app`
   address, confirm extraction and a threaded auto-reply.
3. Forward a non-invoice email under Resend; confirm the "skipped" reply.

## Open questions to settle during Task 1

- Does a fresh Resend team get its `<id>.resend.app` receiving domain automatically, and is
  it discoverable via `GET /domains` (`capabilities.receiving === "enabled"`)? Docs only
  describe finding it in the dashboard. The plan assumes it is **not** reliably
  discoverable and uses a `RESEND_INBOUND_DOMAIN` env var, which is correct for a
  single-account setup either way.
- Whether the free tier's 3,000/mo quota counts inbound as well as outbound.
- Maximum inbound attachment size (affects whether `MAX_WEBHOOK_BODY_BYTES` and the
  extraction gate need new limits).
