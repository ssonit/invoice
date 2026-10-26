import { task } from "@trigger.dev/sdk";
import type { EmailReplyOutcome } from "@/lib/email-reply-templates";
import { sendInboundEmailReplyNow } from "@/lib/inbound-email/send-reply";

export type SendInboundEmailReplyPayload = {
  inboxId: string;
  messageId: string;
  outcome: EmailReplyOutcome;
};

export const sendInboundEmailReply = task({
  id: "send-inbound-email-reply",
  retry: { maxAttempts: 3 },
  run: async (payload: SendInboundEmailReplyPayload) => {
    await sendInboundEmailReplyNow(payload);
    return { status: "sent" as const, outcome: payload.outcome.type };
  },
});
