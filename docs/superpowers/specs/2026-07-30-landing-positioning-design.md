# Landing Page Positioning Rewrite

**Date:** 2026-07-30
**Status:** Approved for implementation
**Source:** `Invoice_Reader_Product_Ideas.md` §5 (Product Positioning), §7 (Unique Selling Proposition)

## Goal

The landing page (`src/lib/landing/dictionary.ts`, rendered by `src/components/landing/*`)
currently positions the product as generic invoice OCR: *"The new way to read invoices"*, with
"How it works" step 1 describing the user manually forwarding each vendor email to a dedicated
inbox. Neither of those match what the product actually became once
[`2026-07-29-automation-page-design.md`](2026-07-29-automation-page-design.md) shipped: the
user's own AI agent decides which emails are invoices and forwards them, once configured, with
no Gmail/Outlook OAuth and no mailbox access ever granted to this product.

This rewrites the copy — both `en` and `vi` locales — so the landing page tells the product's
actual differentiating story: *your AI agent already reads your inbox; let it forward your
invoices too*, without touching Gmail permissions or scanning the user's mail directly.

## Scope decision

**Copy only.** No component, layout, or props changes. Every section keeps its current shape —
same array lengths (3 "how it works" steps, 4 feature items, 2 pricing plans), same field names
in `LandingDictionary`. Only string values change, and only where the current copy actively
misdescribes the product or fails to carry the positioning.

Sections deliberately **left untouched**, and why:

| Section | Reason unchanged |
| --- | --- |
| `trust.label` | About customer logos, not the ingestion story |
| `how.steps[1]`, `how.steps[2]` | ("AI extracts the fields", "Review in the dashboard") still accurately describe the product |
| `features` | Describes real dashboard capabilities (vendor memory, due-date radar, trend charts), unrelated to how mail arrives |
| `pricing`, `testimonial`, `cta`, most of `footer` | About price and social proof, not the place to re-argue positioning |

A prior brainstorming round considered adding a new "Works with Claude, ChatGPT, Gemini…"
section referencing the shipped Automation page directly, and rejected it for this round: it
would require a new component, which is out of scope for a copy-only pass. The existing
"How it works" step 1 already carries the agent-configures-once idea without needing a new
section — see below.

## Design decisions

**Step 1 of "How it works" changes what it describes, not just its wording.** Today it says
the user forwards each vendor email manually. That is no longer the recommended flow — the
Automation page's whole point is a one-time prompt paste after which the user's own agent
forwards invoices going forward. Rewriting step 1 to describe *that* flow is a bigger change
than a wording pass (the underlying claim changes), but it is still pure copy: no code, no new
component, and the step's shape (`title`, `body`, `points: string[]`, `preview`) is unchanged.

**The hero leads with the agent, not with privacy.** Two headline directions were considered:
leading with "your AI decides" vs. leading with "no OAuth required." The agent angle was chosen
for the headline because it is the more concrete, memorable claim; the privacy angle (no Gmail
OAuth, no mailbox access) is folded into the hero **subtext** instead, where it reads as the
payoff of the headline's claim rather than competing with it for the first thing a visitor
reads.

**`footer.tagline` changes from "AI inbox for invoices" to "AI inbox for finance"** to match the
exact positioning phrase in the source document (§7: "AI Inbox for Finance"). This is the
smallest, single-string change in the whole spec, worth calling out only because it's easy to
skip past.

## Copy changes

All eight changed fields, exact before/after, both locales. Everything not listed here in
`src/lib/landing/dictionary.ts` stays byte-for-byte identical.

### `en`

| Field | Before | After |
| --- | --- | --- |
| `hero.headline` | `"The new way to"` | `"Your AI already reads"` |
| `hero.headlineAccent` | `"read invoices."` | `"your inbox."` |
| `hero.subtext` | `"Forward vendor emails. AI extracts totals, vendors, and due dates into a clean dashboard."` | `"Tell it to forward invoices too. No Gmail OAuth, no mailbox access — just the bills that matter, landing in one dashboard."` |
| `how.steps[0].title` | `"Forward the email"` | `"Set up your AI agent once"` |
| `how.steps[0].body` | `"Send vendor invoices to your dedicated AgentMail inbox. PDF or image, same flow."` | `"Paste one prompt into Claude, ChatGPT, or Gemini. From then on, it forwards invoices for you — you never touch this again."` |
| `how.steps[0].points` | `["Works with PDF and image attachments", "Dedicated inbox per workspace", "No manual upload ritual"]` | `["Works with Claude, ChatGPT, Gemini, and more", "One prompt, forwards forever", "Your AI decides what's an invoice"]` |
| `how.steps[0].preview` | `"invoice@inbox → AgentMail"` | `"Claude → invoice@inbox"` |
| `footer.tagline` | `"AI inbox for invoices."` | `"AI inbox for finance."` |

### `vi`

| Field | Before | After |
| --- | --- | --- |
| `hero.headline` | `"Cách mới để"` | `"AI của bạn đã đọc"` |
| `hero.headlineAccent` | `"đọc hóa đơn."` | `"hộp thư rồi."` |
| `hero.subtext` | `"Chuyển tiếp email NCC. AI trích xuất tổng tiền, nhà cung cấp và hạn thanh toán vào dashboard gọn."` | `"Hãy để nó chuyển tiếp cả hóa đơn. Không cần cấp quyền Gmail, không đụng tới hộp thư — chỉ hóa đơn thật sự cần, gom vào một dashboard."` |
| `how.steps[0].title` | `"Chuyển tiếp email"` | `"Cấu hình AI agent một lần"` |
| `how.steps[0].body` | `"Gửi hóa đơn tới hộp thư AgentMail riêng. PDF hay ảnh, cùng một luồng."` | `"Dán một prompt vào Claude, ChatGPT hoặc Gemini. Từ đó AI tự chuyển tiếp hóa đơn cho bạn — không cần làm lại nữa."` |
| `how.steps[0].points` | `["Hỗ trợ PDF và ảnh đính kèm", "Hộp thư riêng theo workspace", "Không cần upload thủ công"]` | `["Dùng được với Claude, ChatGPT, Gemini và nhiều AI khác", "Một prompt, chuyển tiếp mãi mãi", "AI của bạn tự quyết định đâu là hóa đơn"]` |
| `how.steps[0].preview` | `"invoice@inbox → AgentMail"` | `"Claude → invoice@inbox"` |
| `footer.tagline` | `"Hộp thư AI cho hóa đơn."` | `"Hộp thư AI cho tài chính."` |

Step 1's `preview` value stays identical across `en`/`vi` (`"Claude → invoice@inbox"` in both),
matching the *current* dictionary's own precedent for this exact field — today's value,
`"invoice@inbox → AgentMail"`, is already untranslated in both locales. This is specific to
step 1: steps 2 and 3's `preview` values are genuinely translated (e.g. `"Total · Vendor · Due
date"` vs `"Tổng · NCC · Hạn TT"`) and are untouched by this spec regardless.

## Components

| File | Modified | Responsibility |
| --- | --- | --- |
| `src/lib/landing/dictionary.ts` | Yes | The eight field values listed above, in both the `en` and `vi` objects |

No other file changes. `src/components/landing/hero.tsx` and `how-it-works.tsx` already render
`headline`/`headlineAccent`/`steps[].{title,body,points,preview}` generically — confirmed via
`hero.tsx`'s render (`{t.hero.headline} <span>{t.hero.headlineAccent}</span>`), so new string
values of the same type flow through with no code change.

## Error handling

Not applicable — this is a static content change with no runtime branching, no new inputs, no
new failure modes.

## Testing

`.claude/rules/testing.md` scopes the automated test layer to pure `src/lib/` logic; static
copy dictionaries have no logic to unit-test. Verification is manual:

1. Load the landing page in both `en` and `vi` locales (the existing locale switcher).
2. Confirm the hero headline reads naturally in both languages and the accent span still
   receives its gradient styling (no layout break from string-length changes).
3. Confirm "How it works" step 1's card renders the new title/body/points/preview without
   truncation or overflow — the new body text is close in length to the original, but check
   visually since this project doesn't have a copy-length lint.
4. Confirm the footer tagline change appears correctly in both locales.
5. Read every changed string once more in context (not just in the diff) for tone consistency
   with the surrounding unchanged copy — per this project's general copy-quality bar, not a
   formal rule.

Gate: none beyond the existing `npm run lint` / `npx tsc --noEmit` (a string-only change to an
already-typed object cannot introduce a type error, but running the gate costs nothing and
confirms nothing else was touched by mistake).

## Out of scope

A dedicated "Works with your AI agent" section referencing the Automation page by name or
screenshot; any change to `features`, `pricing`, `testimonial`, the final `cta`, or the rest of
`footer`; any new locale; any change to `nav`, since none of its labels reference the ingestion
story. If a dedicated agent-integrations section is wanted later, that is a new component and
needs its own spec.
