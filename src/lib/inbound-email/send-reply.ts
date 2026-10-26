import "server-only";
import { getAgentMailClient } from "@/lib/agentmail";
import { buildReplyText, type EmailReplyOutcome } from "@/lib/email-reply-templates";

export async function sendInboundEmailReplyNow(params: {
  inboxId: string;
  messageId: string;
  outcome: EmailReplyOutcome;
}) {
  const { inboxId, messageId, outcome } = params;
  await getAgentMailClient().inboxes.messages.reply(inboxId, messageId, {
    text: buildReplyText(outcome),
  });
}
