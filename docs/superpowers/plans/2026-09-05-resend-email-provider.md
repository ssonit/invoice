# Resend Email Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the email backend swappable via `EMAIL_PROVIDER` and add a working Resend adapter alongside the existing AgentMail one, so per-customer forwarding addresses stop being capped by AgentMail's inbox quota.

**Architecture:** A provider-neutral interface (`provisionAddress` / `fetchAttachment` / `sendReply`) behind a dispatch table in `src/lib/email/index.ts`, mirroring `src/lib/extraction/index.ts`. Each provider gets its own webhook route, so the live AgentMail path is never branched through. Which adapter services a given inbox is stored per row in `inboxes.provider`; `EMAIL_PROVIDER` only decides what new inboxes are provisioned with.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Vitest, Supabase, Trigger.dev v4, `agentmail@^0.5.16`, `resend` (new), `svix` (already present — both vendors sign with it).

**Spec:** [`../specs/2026-09-05-resend-email-provider-design.md`](../specs/2026-09-05-resend-email-provider-design.md)

## Global Constraints

- **Read the Next.js docs first.** Per `AGENTS.md`, this Next.js has breaking changes vs. training data — consult `node_modules/next/dist/docs/` before writing route handlers.
- **Never delete user data.** Per `.claude/rules/data-safety.md`, migrations are additive; no `DROP COLUMN`, no `DELETE`.
- **Swappable backends go through a dispatch table** selected by env var, never hardcoded at the call site (`.claude/rules/code-style.md`).
- **No magic strings/numbers** — name them in `src/constants/` (`.claude/rules/constants.md`).
- **Expected errors are return values, not exceptions**; unexpected errors throw and are logged as `console.error("Failed to <thing>", <id>, error)`. Never surface a raw SDK error to the user (`.claude/rules/errors.md`).
- **Options object** for functions beyond 2–3 parameters (`.claude/rules/code-style.md`).
- **Unit-test pure `src/lib/` logic only.** API routes, Server Actions, `src/trigger/*`, and thin SDK wrappers are verified manually, not unit tested (`.claude/rules/testing.md`).
- **Quality gate before merge:** `npm run test && npm run lint && npx tsc --noEmit`, then `graphify update .` on `main` after merging.
- Work in a worktree: `git worktree add -b feature/resend-email-provider .claude/worktrees/resend-email-provider`.

---

### Task 1: Resend account spike + SDK + env schema

Settles the spec's open questions before any code depends on the answers, and puts the config plumbing in place.

**Files:**
- Modify: `package.json` (add `resend`)
- Modify: `src/constants/email.ts` (create)
- Modify: `src/lib/validation/env.ts:5-40`
- Test: `src/lib/validation/env.test.ts`
- Modify: `docs/third-party-services.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `EMAIL_PROVIDER`, `EmailProviderId`, `EMAIL_PROVIDER_IDS`, `DEFAULT_EMAIL_PROVIDER`, `INBOX_USERNAME_PREFIX`, `INBOX_USERNAME_ID_LENGTH` from `@/constants/email`; env vars `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_INBOUND_DOMAIN`, `RESEND_WEBHOOK_SECRET`.

- [ ] **Step 1: Create a free Resend account and record the answers**

Sign up at `resend.com`, then in the dashboard open **Emails → Receiving → ⋯** and copy the `<id>.resend.app` subdomain. Record in `docs/third-party-services.md` under a new `## Resend (inbound + outbound email)` section:
- the inbound subdomain
- whether `GET /domains` returns it with `capabilities.receiving === "enabled"` (check with `curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains`)
- whether the 3,000/mo free quota counts inbound
- the maximum inbound attachment size

These were the spec's open questions. Whatever the answers, the code below uses `RESEND_INBOUND_DOMAIN` as the source of truth.

- [ ] **Step 2: Install the SDK**

```bash
npm install resend
```

- [ ] **Step 3: Create the email constants**

Create `src/constants/email.ts`:

```ts
export const EMAIL_PROVIDER = {
  AGENTMAIL: "agentmail",
  RESEND: "resend",
} as const;

export type EmailProviderId = (typeof EMAIL_PROVIDER)[keyof typeof EMAIL_PROVIDER];

export const EMAIL_PROVIDER_IDS: readonly EmailProviderId[] = Object.values(EMAIL_PROVIDER);

/** Provider used when EMAIL_PROVIDER is unset — keeps existing deployments on AgentMail. */
export const DEFAULT_EMAIL_PROVIDER: EmailProviderId = EMAIL_PROVIDER.AGENTMAIL;

/** Forwarding-address local part: `inv-` + the first 8 chars of the user's UUID. */
export const INBOX_USERNAME_PREFIX = "inv-";
export const INBOX_USERNAME_ID_LENGTH = 8;
```

- [ ] **Step 4: Write the failing env tests**

Append to `src/lib/validation/env.test.ts`:

```ts
describe("parseEnvInput — EMAIL_PROVIDER", () => {
  it("accepts an unset EMAIL_PROVIDER (defaults to agentmail)", () => {
    const result = parseEnvInput({ ...validBase, ANTHROPIC_API_KEY: "sk-ant-x" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown EMAIL_PROVIDER", () => {
    const result = parseEnvInput({
      ...validBase,
      ANTHROPIC_API_KEY: "sk-ant-x",
      EMAIL_PROVIDER: "mailchimp",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/EMAIL_PROVIDER/);
  });

  it("rejects EMAIL_PROVIDER=resend without RESEND_API_KEY", () => {
    const result = parseEnvInput({
      ...validBase,
      ANTHROPIC_API_KEY: "sk-ant-x",
      EMAIL_PROVIDER: "resend",
      RESEND_INBOUND_DOMAIN: "abc123.resend.app",
      RESEND_WEBHOOK_SECRET: "whsec_x",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/RESEND_API_KEY/);
  });

  it("rejects EMAIL_PROVIDER=resend without RESEND_INBOUND_DOMAIN", () => {
    const result = parseEnvInput({
      ...validBase,
      ANTHROPIC_API_KEY: "sk-ant-x",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_x",
      RESEND_WEBHOOK_SECRET: "whsec_x",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/RESEND_INBOUND_DOMAIN/);
  });

  it("rejects EMAIL_PROVIDER=resend without RESEND_WEBHOOK_SECRET", () => {
    const result = parseEnvInput({
      ...validBase,
      ANTHROPIC_API_KEY: "sk-ant-x",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_x",
      RESEND_INBOUND_DOMAIN: "abc123.resend.app",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/RESEND_WEBHOOK_SECRET/);
  });

  it("accepts a fully-configured resend environment", () => {
    const result = parseEnvInput({
      ...validBase,
      ANTHROPIC_API_KEY: "sk-ant-x",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_x",
      RESEND_INBOUND_DOMAIN: "abc123.resend.app",
      RESEND_WEBHOOK_SECRET: "whsec_x",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation/env.test.ts`
Expected: the four `resend` cases FAIL (the schema accepts anything today, so `success` is `true` where `false` is asserted).

- [ ] **Step 6: Extend the env schema**

In `src/lib/validation/env.ts`, add the import and the optional fields inside `z.object({...})`, after `AGENTMAIL_WEBHOOK_SECRET`:

```ts
import { DEFAULT_EMAIL_PROVIDER, EMAIL_PROVIDER, EMAIL_PROVIDER_IDS } from "@/constants/email";
```

```ts
    // Which backend provisions NEW forwarding addresses. Existing inboxes are
    // serviced by whatever provider is recorded on their own row.
    EMAIL_PROVIDER: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    // The catch-all receiving domain, e.g. "abc123.resend.app".
    RESEND_INBOUND_DOMAIN: z.string().optional(),
    RESEND_WEBHOOK_SECRET: z.string().optional(),
```

Then add a third `.superRefine` after the billing one:

```ts
  .superRefine((env, ctx) => {
    const provider = (env.EMAIL_PROVIDER || DEFAULT_EMAIL_PROVIDER).toLowerCase();
    if (!(EMAIL_PROVIDER_IDS as readonly string[]).includes(provider)) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown EMAIL_PROVIDER "${provider}" — use ${EMAIL_PROVIDER_IDS.join(" or ")}.`,
      });
      return;
    }
    if (provider !== EMAIL_PROVIDER.RESEND) return;

    if (!env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message: "RESEND_API_KEY is required when EMAIL_PROVIDER is resend.",
      });
    }
    if (!env.RESEND_INBOUND_DOMAIN) {
      ctx.addIssue({
        code: "custom",
        message: "RESEND_INBOUND_DOMAIN is required when EMAIL_PROVIDER is resend.",
      });
    }
    if (!env.RESEND_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: "custom",
        message: "RESEND_WEBHOOK_SECRET is required when EMAIL_PROVIDER is resend.",
      });
    }
  });
```

Note `AGENTMAIL_API_KEY` / `AGENTMAIL_WEBHOOK_SECRET` stay **required** — existing inboxes still need them regardless of `EMAIL_PROVIDER`. Loosening them is a later cleanup, once no rows have `provider = 'agentmail'`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validation/env.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/constants/email.ts src/lib/validation/env.ts src/lib/validation/env.test.ts docs/third-party-services.md
git commit -m "feat(email): add Resend SDK, email provider constants and env validation"
```

---

### Task 2: Provider-neutral types and pure address helpers

**Files:**
- Create: `src/lib/email/types.ts`
- Create: `src/lib/email/address.ts`
- Test: `src/lib/email/address.test.ts`

**Interfaces:**
- Consumes: `EmailProviderId`, `INBOX_USERNAME_PREFIX`, `INBOX_USERNAME_ID_LENGTH` from Task 1.
- Produces: types `ProvisionedAddress`, `InboundAttachment`, `NormalizedInboundEmail`, `FetchAttachmentArgs`, `SendReplyArgs`, `EmailAdapter`; functions `buildInboxUsername(userId: string): string`, `buildResendAddress({ userId, inboundDomain }): string`, `normalizeEmailAddress(address: string): string`.

- [ ] **Step 1: Create the shared types**

Create `src/lib/email/types.ts`:

```ts
import type { EmailProviderId } from "@/constants/email";

/** A forwarding address handed to a user, plus how to route mail back to them. */
export type ProvisionedAddress = {
  provider: EmailProviderId;
  /** Routing key stored in `inboxes.provider_inbox_id`. */
  providerInboxId: string;
  emailAddress: string;
};

export type InboundAttachment = {
  attachmentId: string;
  filename: string | null;
  contentType: string | null;
  size: number | null;
};

/** One inbound email, in the shape the extraction pipeline consumes. */
export type NormalizedInboundEmail = {
  providerInboxId: string;
  /** Provider-side id used to fetch attachments and to reply. */
  messageId: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  attachments: InboundAttachment[];
  /** Reply context. AgentMail threads from messageId alone and ignores these. */
  fromAddress: string | null;
  toAddress: string | null;
  /** RFC 5322 Message-ID, used for the In-Reply-To header under Resend. */
  rfcMessageId: string | null;
};

export type FetchAttachmentArgs = {
  providerInboxId: string;
  messageId: string;
  attachmentId: string;
};

export type SendReplyArgs = {
  providerInboxId: string;
  messageId: string;
  text: string;
  fromAddress: string | null;
  toAddress: string | null;
  subject: string | null;
  rfcMessageId: string | null;
};

export type EmailAdapter = {
  provisionAddress(userId: string): Promise<ProvisionedAddress>;
  fetchAttachment(args: FetchAttachmentArgs): Promise<Buffer>;
  sendReply(args: SendReplyArgs): Promise<void>;
};
```

- [ ] **Step 2: Write the failing address tests**

Create `src/lib/email/address.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildInboxUsername, buildResendAddress, normalizeEmailAddress } from "./address";

const USER_ID = "3f7a2b1c-9d8e-4a5f-b6c7-0123456789ab";

describe("buildInboxUsername", () => {
  it("prefixes the first 8 characters of the user id", () => {
    expect(buildInboxUsername(USER_ID)).toBe("inv-3f7a2b1c");
  });

  it("uses the whole id when it is shorter than the slice length", () => {
    expect(buildInboxUsername("abc")).toBe("inv-abc");
  });

  it("throws on an empty user id rather than producing a bare prefix", () => {
    expect(() => buildInboxUsername("")).toThrow(/user id/i);
  });
});

describe("buildResendAddress", () => {
  it("joins the username to the inbound domain", () => {
    expect(buildResendAddress({ userId: USER_ID, inboundDomain: "abc123.resend.app" })).toBe(
      "inv-3f7a2b1c@abc123.resend.app",
    );
  });

  it("tolerates a domain given with a leading @", () => {
    expect(buildResendAddress({ userId: USER_ID, inboundDomain: "@abc123.resend.app" })).toBe(
      "inv-3f7a2b1c@abc123.resend.app",
    );
  });

  it("lowercases the domain", () => {
    expect(buildResendAddress({ userId: USER_ID, inboundDomain: "ABC123.Resend.App" })).toBe(
      "inv-3f7a2b1c@abc123.resend.app",
    );
  });

  it("throws when the inbound domain is empty", () => {
    expect(() => buildResendAddress({ userId: USER_ID, inboundDomain: "" })).toThrow(/domain/i);
  });
});

describe("normalizeEmailAddress", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmailAddress("  INV-3F7A@Abc.Resend.App ")).toBe("inv-3f7a@abc.resend.app");
  });

  it("strips a display-name wrapper", () => {
    expect(normalizeEmailAddress('"Acme Billing" <billing@acme.com>')).toBe("billing@acme.com");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeEmailAddress("")).toBe("");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/email/address.test.ts`
Expected: FAIL — `Failed to resolve import "./address"`.

- [ ] **Step 4: Implement the address helpers**

Create `src/lib/email/address.ts`:

```ts
import { INBOX_USERNAME_ID_LENGTH, INBOX_USERNAME_PREFIX } from "@/constants/email";

/** Local part of a user's forwarding address, e.g. `inv-3f7a2b1c`. */
export function buildInboxUsername(userId: string): string {
  if (!userId) throw new Error("Cannot build an inbox username from an empty user id");
  return `${INBOX_USERNAME_PREFIX}${userId.slice(0, INBOX_USERNAME_ID_LENGTH)}`;
}

/**
 * Resend's receiving domain is catch-all, so an address exists the moment we
 * name it — there is no provisioning call to make.
 */
export function buildResendAddress({
  userId,
  inboundDomain,
}: {
  userId: string;
  inboundDomain: string;
}): string {
  const domain = inboundDomain.trim().replace(/^@/, "").toLowerCase();
  if (!domain) throw new Error("Cannot build a Resend address without an inbound domain");
  return `${buildInboxUsername(userId)}@${domain}`;
}

/**
 * Canonical form used to match an inbound recipient against `inboxes`.
 * Accepts both a bare address and a `Name <addr>` header value.
 */
export function normalizeEmailAddress(address: string): string {
  const angled = address.match(/<([^>]+)>/);
  return (angled?.[1] ?? address).trim().toLowerCase();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/email/address.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/types.ts src/lib/email/address.ts src/lib/email/address.test.ts
git commit -m "feat(email): add provider-neutral types and address helpers"
```

---

### Task 3: Add provider columns to `inboxes`

**Files:**
- Create: `supabase/migrations/20260905120000_inbox_provider.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: columns `inboxes.provider` (text, not null, default `'agentmail'`) and `inboxes.provider_inbox_id` (text, nullable, backfilled).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260905120000_inbox_provider.sql`:

```sql
-- Make the forwarding inbox provider-neutral so AgentMail and Resend rows can
-- coexist during the migration. Additive only: no column is dropped and no row
-- is deleted (see .claude/rules/data-safety.md). agentmail_inbox_id only loses
-- its NOT NULL, which is a constraint loosening, not data loss. Retiring that
-- column is left as a later cleanup, once no rows have provider = 'agentmail'.

alter table public.inboxes
  add column provider text not null default 'agentmail';

alter table public.inboxes
  add column provider_inbox_id text;

-- Backfill: for existing rows the routing key is the AgentMail inbox id.
update public.inboxes
  set provider_inbox_id = agentmail_inbox_id
  where provider_inbox_id is null;

alter table public.inboxes
  alter column agentmail_inbox_id drop not null;

alter table public.inboxes
  add constraint inboxes_provider_check
  check (provider in ('agentmail', 'resend'));

-- Inbound routing looks a row up by this key on every received email.
create index inboxes_provider_inbox_id_idx
  on public.inboxes (provider_inbox_id);
```

- [ ] **Step 2: Apply and verify against local Supabase**

```bash
npx supabase db reset
```

Then confirm the backfill and constraint:

```bash
npx supabase db diff --schema public
```

Expected: no pending diff. Then in `npx supabase db shell` (or Studio), run:

```sql
select provider, count(*), count(provider_inbox_id) from public.inboxes group by provider;
```

Expected: every existing row has `provider = 'agentmail'` and a non-null `provider_inbox_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260905120000_inbox_provider.sql
git commit -m "feat(db): add provider and provider_inbox_id to inboxes"
```

---

### Task 4: AgentMail adapter (behavior-preserving move)

Moves the existing AgentMail code behind the new interface with **no behavior change**, so a later task can swap call sites without also changing what those call sites do.

**Files:**
- Create: `src/lib/email/agentmail.ts`
- Delete-after-move: `src/lib/agentmail.ts` (its `agentmail` client export moves; nothing is lost)

**Interfaces:**
- Consumes: `EmailAdapter`, `FetchAttachmentArgs`, `SendReplyArgs`, `ProvisionedAddress` (Task 2); `buildInboxUsername` (Task 2); `EMAIL_PROVIDER` (Task 1).
- Produces: `agentmailAdapter: EmailAdapter`, and the raw `agentmail` client re-exported for any remaining direct use.

- [ ] **Step 1: Create the adapter**

Create `src/lib/email/agentmail.ts` — the `findExistingInboxForUser` fallback is carried over verbatim from `src/lib/agentmail.ts:12-32` because it is the only recovery path when a username is already taken:

```ts
import "server-only";
import { AgentMail, AgentMailClient } from "agentmail";
import { EMAIL_PROVIDER } from "@/constants/email";
import { buildInboxUsername } from "./address";
import type {
  EmailAdapter,
  FetchAttachmentArgs,
  ProvisionedAddress,
  SendReplyArgs,
} from "./types";

export const agentmail = new AgentMailClient({
  apiKey: process.env.AGENTMAIL_API_KEY!,
});

async function findExistingInboxForUser(userId: string) {
  const username = buildInboxUsername(userId);
  let pageToken: string | undefined;

  do {
    const { inboxes, nextPageToken } = await agentmail.inboxes.list({
      limit: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    const found =
      inboxes.find((inbox) => inbox.metadata?.user_id === userId) ??
      inboxes.find((inbox) => inbox.email.startsWith(`${username}@`)) ??
      null;

    if (found) return found;

    pageToken = nextPageToken ?? undefined;
  } while (pageToken);

  return null;
}

async function provisionAddress(userId: string): Promise<ProvisionedAddress> {
  const username = buildInboxUsername(userId);
  try {
    const inbox = await agentmail.inboxes.create({
      username,
      metadata: { user_id: userId },
    });
    return {
      provider: EMAIL_PROVIDER.AGENTMAIL,
      providerInboxId: inbox.inboxId,
      emailAddress: inbox.email,
    };
  } catch (err) {
    if (err instanceof AgentMail.IsTakenError) {
      const existing = await findExistingInboxForUser(userId);
      if (existing) {
        return {
          provider: EMAIL_PROVIDER.AGENTMAIL,
          providerInboxId: existing.inboxId,
          emailAddress: existing.email,
        };
      }
    }
    throw err;
  }
}

async function fetchAttachment({
  providerInboxId,
  messageId,
  attachmentId,
}: FetchAttachmentArgs): Promise<Buffer> {
  const { downloadUrl } = await agentmail.inboxes.messages.getAttachment(
    providerInboxId,
    messageId,
    attachmentId,
  );
  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    throw new Error(
      `Failed to download attachment ${attachmentId}: AgentMail returned ${fileRes.status} ${fileRes.statusText}`,
    );
  }
  return Buffer.from(await fileRes.arrayBuffer());
}

// AgentMail threads from the original message id, so fromAddress / toAddress /
// subject / rfcMessageId in SendReplyArgs are unused here — they exist for Resend.
async function sendReply({ providerInboxId, messageId, text }: SendReplyArgs): Promise<void> {
  await agentmail.inboxes.messages.reply(providerInboxId, messageId, { text });
}

export const agentmailAdapter: EmailAdapter = {
  provisionAddress,
  fetchAttachment,
  sendReply,
};
```

- [ ] **Step 2: Delete the old module**

```bash
git rm src/lib/agentmail.ts
```

This breaks three imports on purpose; Task 5 repairs them. Do not fix them here.

- [ ] **Step 3: Confirm the expected breakage**

Run: `npx tsc --noEmit`
Expected: FAIL with "Cannot find module '@/lib/agentmail'" in exactly three files — `src/app/dashboard/actions.ts`, `src/trigger/process-attachment.ts`, `src/trigger/send-inbound-email-reply.ts`. If any other file appears, stop and re-check.

- [ ] **Step 4: Commit**

```bash
git add src/lib/email/agentmail.ts src/lib/agentmail.ts
git commit -m "refactor(email): move AgentMail behind the EmailAdapter interface"
```

---

### Task 5: Dispatch table and call-site rewiring

**Files:**
- Create: `src/lib/email/index.ts`
- Modify: `src/app/dashboard/actions.ts:8` and `:64-90`
- Modify: `src/trigger/process-attachment.ts:2,40-52`
- Modify: `src/trigger/send-inbound-email-reply.ts` (whole file)
- Modify: `src/trigger/process-inbound-email.ts:23-40,62-70,168`
- Modify: `src/app/api/webhooks/agentmail/route.ts:44-60`

**Interfaces:**
- Consumes: `agentmailAdapter` (Task 4); `EMAIL_PROVIDER`, `DEFAULT_EMAIL_PROVIDER`, `EmailProviderId` (Task 1); `EmailAdapter` types (Task 2).
- Produces: `resolveEmailProvider(): EmailProviderId`, `provisionAddress(userId): Promise<ProvisionedAddress>`, `fetchAttachment({ provider, ...FetchAttachmentArgs }): Promise<Buffer>`, `sendReply({ provider, ...SendReplyArgs }): Promise<void>`. `ProcessInboundEmailPayload` and `SendInboundEmailReplyPayload` gain `provider`, `fromAddress`, `toAddress`, `rfcMessageId`; `inboxId` is renamed `providerInboxId`.

- [ ] **Step 1: Create the dispatch table**

Create `src/lib/email/index.ts`, mirroring `src/lib/extraction/index.ts`:

```ts
import "server-only";
import {
  DEFAULT_EMAIL_PROVIDER,
  EMAIL_PROVIDER,
  EMAIL_PROVIDER_IDS,
  type EmailProviderId,
} from "@/constants/email";
import { agentmailAdapter } from "./agentmail";
import { resendAdapter } from "./resend";
import type { EmailAdapter, FetchAttachmentArgs, ProvisionedAddress, SendReplyArgs } from "./types";

export type {
  InboundAttachment,
  NormalizedInboundEmail,
  ProvisionedAddress,
} from "./types";

// Which backend provisions NEW forwarding addresses. Existing inboxes are
// serviced by the provider recorded on their own `inboxes` row, so a rollout
// can move new users to Resend while old users stay on AgentMail.
const adapters: Record<EmailProviderId, EmailAdapter> = {
  [EMAIL_PROVIDER.AGENTMAIL]: agentmailAdapter,
  [EMAIL_PROVIDER.RESEND]: resendAdapter,
};

export function resolveEmailProvider(): EmailProviderId {
  const configured = (process.env.EMAIL_PROVIDER || DEFAULT_EMAIL_PROVIDER).toLowerCase();
  if ((EMAIL_PROVIDER_IDS as readonly string[]).includes(configured)) {
    return configured as EmailProviderId;
  }
  throw new Error(
    `Unknown EMAIL_PROVIDER "${configured}" — use ${EMAIL_PROVIDER_IDS.join(" or ")}.`,
  );
}

export function provisionAddress(userId: string): Promise<ProvisionedAddress> {
  return adapters[resolveEmailProvider()].provisionAddress(userId);
}

export function fetchAttachment(
  args: FetchAttachmentArgs & { provider: EmailProviderId },
): Promise<Buffer> {
  return adapters[args.provider].fetchAttachment(args);
}

export function sendReply(args: SendReplyArgs & { provider: EmailProviderId }): Promise<void> {
  return adapters[args.provider].sendReply(args);
}
```

- [ ] **Step 2: Rewire the Server Action**

In `src/app/dashboard/actions.ts`, replace the import on line 8:

```ts
import { provisionAddress } from "@/lib/email";
```

and replace the `createUserInbox` call and insert (lines 64-70) with:

```ts
    const address = await provisionAddress(user.id);
    const { error } = await service.from("inboxes").insert({
      user_id: user.id,
      provider: address.provider,
      provider_inbox_id: address.providerInboxId,
      agentmail_inbox_id:
        address.provider === EMAIL_PROVIDER.AGENTMAIL ? address.providerInboxId : null,
      email_address: address.emailAddress,
    });
```

Add `import { EMAIL_PROVIDER } from "@/constants/email";` at the top. Replace the two later
references to `inbox.email` with `address.emailAddress`. Leave the `23505` unique-violation
branch and the error messages exactly as they are — they are already correct.

- [ ] **Step 3: Widen the task payloads**

In `src/trigger/process-inbound-email.ts`, replace the payload type (lines 23-40) with:

```ts
import type { EmailProviderId } from "@/constants/email";

export type ProcessInboundEmailPayload = {
  provider: EmailProviderId;
  providerInboxId: string;
  messageId: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  attachments: {
    attachmentId: string;
    filename: string | null;
    contentType: string | null;
    size: number | null;
  }[];
  fromAddress: string | null;
  toAddress: string | null;
  rfcMessageId: string | null;
};
```

Replace `triggerReply` with a version that forwards the reply context:

```ts
function triggerReply(
  payload: ProcessInboundEmailPayload,
  outcome: EmailReplyOutcome,
  idempotencyKey: string,
) {
  return tasks.trigger<typeof sendInboundEmailReply>(
    "send-inbound-email-reply",
    {
      provider: payload.provider,
      providerInboxId: payload.providerInboxId,
      messageId: payload.messageId,
      outcome,
      fromAddress: payload.toAddress,
      toAddress: payload.fromAddress,
      subject: payload.subject,
      rfcMessageId: payload.rfcMessageId,
    },
    { idempotencyKey },
  );
}
```

Note the deliberate swap: the reply is sent **from** the address the mail arrived at
(`payload.toAddress`) **to** the original sender (`payload.fromAddress`).

Update both call sites to `triggerReply(payload, { type: "error" }, ...)` and
`triggerReply(payload, outcome, ...)`, and change the inbox lookup to:

```ts
      .eq("provider_inbox_id", payload.providerInboxId)
```

Update the `console.error` for the unknown-inbox case to log `providerInboxId` instead of
`inboxId`, and replace `inboxId: payload.inboxId` in the `processAttachment` payload with
`provider: payload.provider, providerInboxId: payload.providerInboxId`.

- [ ] **Step 4: Rewire the attachment task**

In `src/trigger/process-attachment.ts`, replace the import and the download block
(lines 2, 40-52):

```ts
import { fetchAttachment } from "@/lib/email";
import type { EmailProviderId } from "@/constants/email";
```

```ts
export type ProcessAttachmentPayload = {
  provider: EmailProviderId;
  providerInboxId: string;
  messageId: string;
  userId: string;
  attachment: {
    attachmentId: string;
    filename: string | null;
    contentType: string | null;
    size: number | null;
  };
};
```

```ts
    const fileBuffer = await fetchAttachment({
      provider: payload.provider,
      providerInboxId: payload.providerInboxId,
      messageId: payload.messageId,
      attachmentId: attachment.attachmentId,
    });
```

The `fileRes.ok` check moves into each adapter (already present in Task 4's AgentMail
adapter), so delete it here.

- [ ] **Step 5: Rewire the reply task**

Replace `src/trigger/send-inbound-email-reply.ts` entirely:

```ts
import { task } from "@trigger.dev/sdk";
import type { EmailProviderId } from "@/constants/email";
import { sendReply } from "@/lib/email";
import { buildReplyText, type EmailReplyOutcome } from "@/lib/email-reply-templates";

export type SendInboundEmailReplyPayload = {
  provider: EmailProviderId;
  providerInboxId: string;
  messageId: string;
  outcome: EmailReplyOutcome;
  fromAddress: string | null;
  toAddress: string | null;
  subject: string | null;
  rfcMessageId: string | null;
};

export const sendInboundEmailReply = task({
  id: "send-inbound-email-reply",
  retry: { maxAttempts: 3 },
  run: async (payload: SendInboundEmailReplyPayload) => {
    await sendReply({
      provider: payload.provider,
      providerInboxId: payload.providerInboxId,
      messageId: payload.messageId,
      text: buildReplyText(payload.outcome),
      fromAddress: payload.fromAddress,
      toAddress: payload.toAddress,
      subject: payload.subject,
      rfcMessageId: payload.rfcMessageId,
    });
    return { status: "sent" as const, outcome: payload.outcome.type };
  },
});
```

- [ ] **Step 6: Update the AgentMail webhook route to the new payload**

In `src/app/api/webhooks/agentmail/route.ts`, replace the `tasks.trigger` payload
(lines 44-58) so it fills the new fields:

```ts
  await tasks.trigger<typeof processInboundEmail>(
    "process-inbound-email",
    {
      provider: EMAIL_PROVIDER.AGENTMAIL,
      providerInboxId: message.inboxId,
      messageId: message.messageId,
      subject: message.subject ?? null,
      text: message.text ?? message.extractedText ?? null,
      html: message.html ?? message.extractedHtml ?? null,
      attachments: (message.attachments ?? []).map((attachment) => ({
        attachmentId: attachment.attachmentId,
        filename: attachment.filename ?? null,
        contentType: attachment.contentType ?? null,
        size: attachment.size ?? null,
      })),
      fromAddress: message.from ?? null,
      toAddress: (message.to ?? [])[0] ?? null,
      rfcMessageId: null,
    },
    { idempotencyKey: message.messageId },
  );
```

Add `import { EMAIL_PROVIDER } from "@/constants/email";`. `rfcMessageId` is `null`
because AgentMail's reply API threads on its own and never needs it.

- [ ] **Step 7: Create a Resend adapter stub so the dispatch table compiles**

Create `src/lib/email/resend.ts` with a stub that Task 7 fills in. A stub is used rather
than a partial implementation so that Task 5 can be type-checked and reviewed on its own:

```ts
import "server-only";
import type { EmailAdapter } from "./types";

export const resendAdapter: EmailAdapter = {
  provisionAddress: () => {
    throw new Error("Resend adapter not implemented yet");
  },
  fetchAttachment: () => {
    throw new Error("Resend adapter not implemented yet");
  },
  sendReply: () => {
    throw new Error("Resend adapter not implemented yet");
  },
};
```

- [ ] **Step 8: Verify the whole project type-checks and tests pass**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all three PASS. `EMAIL_PROVIDER` is unset, so the default keeps every call on AgentMail.

- [ ] **Step 9: Commit**

```bash
git add src/lib/email src/app/dashboard/actions.ts src/trigger src/app/api/webhooks/agentmail/route.ts
git commit -m "refactor(email): route all email operations through a provider dispatch table"
```

---

### Task 6: Pure Resend webhook normalizer

**Files:**
- Create: `src/lib/email/normalize-resend.ts`
- Test: `src/lib/email/normalize-resend.test.ts`

**Interfaces:**
- Consumes: `NormalizedInboundEmail`, `InboundAttachment` (Task 2); `normalizeEmailAddress` (Task 2).
- Produces: types `ResendInboundEvent`, `ResendReceivedEmail`; function `normalizeResendInbound({ event, received, inboundDomain }): NormalizedInboundEmail | null`.

- [ ] **Step 1: Write the failing normalizer tests**

Create `src/lib/email/normalize-resend.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeResendInbound } from "./normalize-resend";

const INBOUND_DOMAIN = "abc123.resend.app";

const event = {
  type: "email.received",
  data: {
    email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
    from: "billing@acme.com",
    to: ["inv-3f7a2b1c@abc123.resend.app"],
    received_for: [],
    message_id: "<111-222-333@email.acme.com>",
    subject: "Invoice INV-42",
    attachments: [
      {
        id: "2a0c9ce0-3112-4728-976e-47ddcd16a318",
        filename: "invoice.pdf",
        content_type: "application/pdf",
        content_disposition: "attachment",
        content_id: null,
      },
    ],
  },
};

const received = {
  id: "56761188-7520-42d8-8898-ff6fc54ce618",
  text: "Please find the invoice attached.",
  html: "<p>Please find the invoice attached.</p>",
  attachments: [
    {
      id: "2a0c9ce0-3112-4728-976e-47ddcd16a318",
      filename: "invoice.pdf",
      content_type: "application/pdf",
      content_disposition: "attachment",
      content_id: null,
      size: 84213,
    },
  ],
};

describe("normalizeResendInbound", () => {
  it("maps a received email onto the pipeline shape", () => {
    const result = normalizeResendInbound({ event, received, inboundDomain: INBOUND_DOMAIN });
    expect(result).toEqual({
      providerInboxId: "inv-3f7a2b1c@abc123.resend.app",
      messageId: "56761188-7520-42d8-8898-ff6fc54ce618",
      subject: "Invoice INV-42",
      text: "Please find the invoice attached.",
      html: "<p>Please find the invoice attached.</p>",
      attachments: [
        {
          attachmentId: "2a0c9ce0-3112-4728-976e-47ddcd16a318",
          filename: "invoice.pdf",
          contentType: "application/pdf",
          size: 84213,
        },
      ],
      fromAddress: "billing@acme.com",
      toAddress: "inv-3f7a2b1c@abc123.resend.app",
      rfcMessageId: "<111-222-333@email.acme.com>",
    });
  });

  it("takes the attachment size from the fetched email, not the webhook", () => {
    // The webhook payload has no `size` field at all — the gate needs it.
    const result = normalizeResendInbound({ event, received, inboundDomain: INBOUND_DOMAIN });
    expect(result?.attachments[0]?.size).toBe(84213);
  });

  it("returns null for a non-received event type", () => {
    const sent = { ...event, type: "email.sent" };
    expect(normalizeResendInbound({ event: sent, received, inboundDomain: INBOUND_DOMAIN })).toBeNull();
  });

  it("returns null when no recipient is on the inbound domain", () => {
    const foreign = { ...event, data: { ...event.data, to: ["someone@elsewhere.com"] } };
    expect(
      normalizeResendInbound({ event: foreign, received, inboundDomain: INBOUND_DOMAIN }),
    ).toBeNull();
  });

  it("picks the inbound-domain recipient when the mail was sent to several addresses", () => {
    const multi = {
      ...event,
      data: { ...event.data, to: ["team@acme.com", "inv-3f7a2b1c@abc123.resend.app"] },
    };
    const result = normalizeResendInbound({ event: multi, received, inboundDomain: INBOUND_DOMAIN });
    expect(result?.providerInboxId).toBe("inv-3f7a2b1c@abc123.resend.app");
  });

  it("falls back to received_for when `to` holds the forwarding address", () => {
    const forwarded = {
      ...event,
      data: {
        ...event.data,
        to: ["someone@elsewhere.com"],
        received_for: ["inv-3f7a2b1c@abc123.resend.app"],
      },
    };
    const result = normalizeResendInbound({
      event: forwarded,
      received,
      inboundDomain: INBOUND_DOMAIN,
    });
    expect(result?.providerInboxId).toBe("inv-3f7a2b1c@abc123.resend.app");
  });

  it("matches the recipient case-insensitively", () => {
    const shouty = { ...event, data: { ...event.data, to: ["INV-3F7A2B1C@ABC123.Resend.App"] } };
    const result = normalizeResendInbound({ event: shouty, received, inboundDomain: INBOUND_DOMAIN });
    expect(result?.providerInboxId).toBe("inv-3f7a2b1c@abc123.resend.app");
  });

  it("tolerates an email with no attachments and no text body", () => {
    const bare = { ...event, data: { ...event.data, attachments: [] } };
    const bareReceived = { ...received, text: null, html: null, attachments: [] };
    const result = normalizeResendInbound({
      event: bare,
      received: bareReceived,
      inboundDomain: INBOUND_DOMAIN,
    });
    expect(result?.attachments).toEqual([]);
    expect(result?.text).toBeNull();
    expect(result?.html).toBeNull();
  });

  it("defaults a missing attachment size to null rather than 0", () => {
    // 0 would read as "tiny decorative image" to isLikelyDecorativeAttachment.
    const sizeless = { ...received, attachments: [{ ...received.attachments[0]!, size: undefined }] };
    const result = normalizeResendInbound({
      event,
      received: sizeless,
      inboundDomain: INBOUND_DOMAIN,
    });
    expect(result?.attachments[0]?.size).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/email/normalize-resend.test.ts`
Expected: FAIL — `Failed to resolve import "./normalize-resend"`.

- [ ] **Step 3: Implement the normalizer**

Create `src/lib/email/normalize-resend.ts`:

```ts
import { normalizeEmailAddress } from "./address";
import type { InboundAttachment, NormalizedInboundEmail } from "./types";

/** The `email.received` webhook body. Metadata only — no body, no attachment sizes. */
export type ResendInboundEvent = {
  type: string;
  data: {
    email_id: string;
    from?: string | null;
    to?: string[] | null;
    received_for?: string[] | null;
    message_id?: string | null;
    subject?: string | null;
    attachments?: { id: string; filename?: string | null; content_type?: string | null }[] | null;
  };
};

/** The `GET /emails/receiving/{id}` response — this is where body and sizes live. */
export type ResendReceivedEmail = {
  id: string;
  text?: string | null;
  html?: string | null;
  attachments?:
    | {
        id: string;
        filename?: string | null;
        content_type?: string | null;
        size?: number | null;
      }[]
    | null;
};

const RECEIVED_EVENT_TYPE = "email.received";

/** First recipient that lives on our catch-all domain, in canonical form. */
function findInboundRecipient(
  data: ResendInboundEvent["data"],
  inboundDomain: string,
): string | null {
  const suffix = `@${inboundDomain.trim().replace(/^@/, "").toLowerCase()}`;
  const candidates = [...(data.to ?? []), ...(data.received_for ?? [])];
  for (const candidate of candidates) {
    const normalized = normalizeEmailAddress(candidate);
    if (normalized.endsWith(suffix)) return normalized;
  }
  return null;
}

/**
 * Combine the metadata-only webhook with the separately-fetched email content.
 * Returns null when the event is not an inbound receipt for one of our
 * addresses — the caller acknowledges those without enqueueing work.
 */
export function normalizeResendInbound({
  event,
  received,
  inboundDomain,
}: {
  event: ResendInboundEvent;
  received: ResendReceivedEmail;
  inboundDomain: string;
}): NormalizedInboundEmail | null {
  if (event.type !== RECEIVED_EVENT_TYPE) return null;

  const recipient = findInboundRecipient(event.data, inboundDomain);
  if (!recipient) return null;

  // Sizes only exist on the fetched email, and the extraction gate needs them
  // to tell an invoice scan from a signature image.
  const attachments: InboundAttachment[] = (received.attachments ?? []).map((attachment) => ({
    attachmentId: attachment.id,
    filename: attachment.filename ?? null,
    contentType: attachment.content_type ?? null,
    size: attachment.size ?? null,
  }));

  return {
    providerInboxId: recipient,
    messageId: event.data.email_id,
    subject: event.data.subject ?? null,
    text: received.text ?? null,
    html: received.html ?? null,
    attachments,
    fromAddress: event.data.from ? normalizeEmailAddress(event.data.from) : null,
    toAddress: recipient,
    rfcMessageId: event.data.message_id ?? null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/email/normalize-resend.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/normalize-resend.ts src/lib/email/normalize-resend.test.ts
git commit -m "feat(email): add pure Resend inbound normalizer"
```

---

### Task 7: Resend adapter

**Files:**
- Modify: `src/lib/email/resend.ts` (replaces the Task 5 stub)

**Interfaces:**
- Consumes: `buildResendAddress` (Task 2); `EmailAdapter`, `FetchAttachmentArgs`, `SendReplyArgs`, `ProvisionedAddress` (Task 2); `EMAIL_PROVIDER` (Task 1).
- Produces: `resendAdapter: EmailAdapter`, `resend` client, `resendInboundDomain(): string`.

- [ ] **Step 1: Implement the adapter**

Replace `src/lib/email/resend.ts` in full:

```ts
import "server-only";
import { Resend } from "resend";
import { EMAIL_PROVIDER } from "@/constants/email";
import { buildResendAddress } from "./address";
import type {
  EmailAdapter,
  FetchAttachmentArgs,
  ProvisionedAddress,
  SendReplyArgs,
} from "./types";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export function resendInboundDomain(): string {
  const domain = process.env.RESEND_INBOUND_DOMAIN;
  if (!domain) throw new Error("RESEND_INBOUND_DOMAIN is not set");
  return domain;
}

/**
 * Resend's receiving domain is catch-all: an address works the moment we name
 * it, so there is no API call to make and no username collision to recover
 * from. The address doubles as its own routing key.
 */
async function provisionAddress(userId: string): Promise<ProvisionedAddress> {
  const emailAddress = buildResendAddress({ userId, inboundDomain: resendInboundDomain() });
  return {
    provider: EMAIL_PROVIDER.RESEND,
    providerInboxId: emailAddress,
    emailAddress,
  };
}

async function fetchAttachment({
  messageId,
  attachmentId,
}: FetchAttachmentArgs): Promise<Buffer> {
  const { data, error } = await resend.emails.receiving.attachments.get({
    emailId: messageId,
    id: attachmentId,
  });
  if (error || !data?.download_url) {
    throw new Error(
      `Failed to resolve attachment ${attachmentId}: ${error?.message ?? "no download_url returned"}`,
    );
  }
  const fileRes = await fetch(data.download_url);
  if (!fileRes.ok) {
    throw new Error(
      `Failed to download attachment ${attachmentId}: Resend returned ${fileRes.status} ${fileRes.statusText}`,
    );
  }
  return Buffer.from(await fileRes.arrayBuffer());
}

/**
 * Resend has no reply primitive — threading is a normal send carrying an
 * In-Reply-To header pointing at the original RFC Message-ID.
 */
async function sendReply({
  text,
  fromAddress,
  toAddress,
  subject,
  rfcMessageId,
}: SendReplyArgs): Promise<void> {
  if (!fromAddress || !toAddress) {
    throw new Error("Cannot send a Resend reply without both a from and a to address");
  }
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [toAddress],
    subject: subject ? `Re: ${subject}` : "Re: your invoice",
    text,
    ...(rfcMessageId ? { headers: { "In-Reply-To": rfcMessageId } } : {}),
  });
  if (error) {
    throw new Error(`Failed to send Resend reply to ${toAddress}: ${error.message}`);
  }
}

export const resendAdapter: EmailAdapter = {
  provisionAddress,
  fetchAttachment,
  sendReply,
};
```

- [ ] **Step 2: Verify types and existing tests still pass**

Run: `npx tsc --noEmit && npm run test`
Expected: PASS. If the `resend` SDK's `receiving.attachments.get` signature differs from the shape above, correct the call to match `node_modules/resend/dist/index.d.ts` — that file is the authority, not this plan.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/resend.ts
git commit -m "feat(email): implement the Resend adapter"
```

---

### Task 8: Resend webhook route

**Files:**
- Create: `src/app/api/webhooks/resend/route.ts`

**Interfaces:**
- Consumes: `normalizeResendInbound`, `ResendInboundEvent`, `ResendReceivedEmail` (Task 6); `resend`, `resendInboundDomain` (Task 7); `EMAIL_PROVIDER` (Task 1); `processInboundEmail` payload type (Task 5); `checkContentLength`, `MAX_WEBHOOK_BODY_BYTES` (existing).
- Produces: `POST /api/webhooks/resend`.

- [ ] **Step 1: Read the route-handler docs**

Per `AGENTS.md`, read `node_modules/next/dist/docs/` for the current route-handler API before writing this file. Mirror `src/app/api/webhooks/agentmail/route.ts` — it is the known-good example in this codebase.

- [ ] **Step 2: Write the route**

Create `src/app/api/webhooks/resend/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { tasks } from "@trigger.dev/sdk";
import { EMAIL_PROVIDER } from "@/constants/email";
import type { processInboundEmail } from "@/trigger/process-inbound-email";
import {
  normalizeResendInbound,
  type ResendInboundEvent,
  type ResendReceivedEmail,
} from "@/lib/email/normalize-resend";
import { resend, resendInboundDomain } from "@/lib/email/resend";
import { checkContentLength } from "@/lib/validation/common";
import { MAX_WEBHOOK_BODY_BYTES } from "@/constants/validation";

export async function POST(request: NextRequest) {
  const contentLength = checkContentLength(request, MAX_WEBHOOK_BODY_BYTES);
  if (!contentLength.success) {
    return NextResponse.json({ error: contentLength.error }, { status: 413 });
  }

  const payload = await request.text();
  if (payload.length > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "Request payload is too large" }, { status: 413 });
  }

  const headers = Object.fromEntries(request.headers);

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Failed to verify Resend webhook: RESEND_WEBHOOK_SECRET is not set");
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  let event: ResendInboundEvent;
  try {
    event = new Webhook(webhookSecret).verify(payload, headers) as ResendInboundEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ status: "ignored" });
  }

  // Resend's webhook carries metadata only — the body and the attachment sizes
  // the extraction gate needs live behind a separate fetch. See the design doc
  // for why this happens here rather than inside the task.
  const { data: received, error } = await resend.emails.receiving.get(event.data.email_id);
  if (error || !received) {
    console.error("Failed to fetch Resend inbound email", event.data.email_id, error);
    // 500 so Resend retries — the alternative is silently dropping the invoice.
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const normalized = normalizeResendInbound({
    event,
    received: received as ResendReceivedEmail,
    inboundDomain: resendInboundDomain(),
  });
  if (!normalized) {
    // Addressed to something outside our catch-all domain. Acknowledge so
    // Resend stops retrying; there is no user to route it to.
    return NextResponse.json({ status: "ignored" });
  }

  // idempotencyKey = messageId means a Resend retry returns the original run
  // instead of starting a duplicate.
  await tasks.trigger<typeof processInboundEmail>(
    "process-inbound-email",
    { provider: EMAIL_PROVIDER.RESEND, ...normalized },
    { idempotencyKey: normalized.messageId },
  );

  return NextResponse.json({ status: "queued" });
}
```

- [ ] **Step 3: Verify the quality gate**

Run: `npm run test && npm run lint && npx tsc --noEmit`
Expected: all three PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/resend/route.ts
git commit -m "feat(email): add the Resend inbound webhook route"
```

---

### Task 9: End-to-end verification and documentation

Per `.claude/rules/testing.md`, routes, Server Actions, and `src/trigger/*` are verified manually rather than unit tested. This task is that verification.

**Files:**
- Modify: `docs/third-party-services.md`
- Modify: `docs/webhook-task-queue.md`
- Modify: `README.md` (env var list)

- [ ] **Step 1: Regression-test the AgentMail path**

With `EMAIL_PROVIDER` unset, run `npm run dev`, `npx supabase start`, and
`npx trigger.dev@latest dev` together. Provision an inbox from the dashboard, forward a
real PDF invoice to it, and confirm: the invoice appears in the dashboard inbox, the
extracted fields are right, and the auto-reply arrives threaded on the original message.

**This is the gate — if anything here regressed, stop and fix before continuing.**

- [ ] **Step 2: Point Resend at the local tunnel**

Start a tunnel (`ngrok http 3000`), then in the Resend dashboard create a webhook on
`https://<tunnel>/api/webhooks/resend` subscribed to `email.received`. Copy its
`whsec_...` signing secret into `.env.local` as `RESEND_WEBHOOK_SECRET`, and set
`RESEND_API_KEY` plus `RESEND_INBOUND_DOMAIN` from Task 1.

- [ ] **Step 3: Test the Resend path**

Set `EMAIL_PROVIDER=resend`, restart `npm run dev`, and provision an inbox for a **new**
test user. Confirm the address ends in `@<id>.resend.app` and that the `inboxes` row has
`provider = 'resend'` with `provider_inbox_id` equal to the address. Forward the same PDF
invoice and confirm extraction plus a threaded auto-reply.

- [ ] **Step 4: Test the skip path**

Forward a plain non-invoice email with no attachment to the Resend address. Confirm the
"skipped" reply arrives and no invoice row is created.

- [ ] **Step 5: Confirm mixed-provider operation**

With `EMAIL_PROVIDER=resend` still set, forward an invoice to the **AgentMail** address
from Step 1. It must still process and reply — this proves `inboxes.provider` (not the env
var) drives servicing of existing inboxes.

- [ ] **Step 6: Document the results**

In `docs/third-party-services.md`, complete the `## Resend` section with the verified
pricing, the answers from Task 1, and the webhook setup steps. In
`docs/webhook-task-queue.md`, document the two-route design and the extra content fetch.
In `README.md`, add `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_INBOUND_DOMAIN`, and
`RESEND_WEBHOOK_SECRET` to the environment variable list.

- [ ] **Step 7: Commit and merge**

```bash
git add docs README.md
git commit -m "docs: document the Resend email provider and its verification"
npm run test && npm run lint && npx tsc --noEmit && npm run build
git checkout main
git merge feature/resend-email-provider
graphify update .
```

---

## Rollout after merge

`EMAIL_PROVIDER` stays unset in production until the Resend path has been exercised on a
preview deployment. Flipping it to `resend` only changes what **new** inboxes get; every
existing customer keeps working through `inboxes.provider`. If anything misbehaves, unset
the variable — no data migration is needed to roll back.
