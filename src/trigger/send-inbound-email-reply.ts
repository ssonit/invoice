import { task } from "@trigger.dev/sdk";
import { agentmail } from "@/lib/agentmail";
import { buildReplyText, type EmailReplyOutcome } from "@/lib/email-reply-templates";

export type SendInboundEmailReplyPayload = {
  inboxId: string;
  messageId: string;
  outcome: EmailReplyOutcome;
};

export const sendInboundEmailReply = task({
  id: "send-inbound-email-reply",
  retry: { maxAttempts: 3 },
  run: async (payload: SendInboundEmailReplyPayload) => {
    const text = buildReplyText(payload.outcome);
    await agentmail.inboxes.messages.reply(payload.inboxId, payload.messageId, {
      text,
    });
    return { status: "sent" as const, outcome: payload.outcome.type };
  },
});
