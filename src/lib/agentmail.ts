import "server-only";
import { AgentMail, AgentMailClient } from "agentmail";

export const agentmail = new AgentMailClient({
  apiKey: process.env.AGENTMAIL_API_KEY!,
});

function inboxUsername(userId: string) {
  return `inv-${userId.slice(0, 8)}`;
}

async function findExistingInboxForUser(userId: string) {
  const username = inboxUsername(userId);
  const { inboxes } = await agentmail.inboxes.list({ limit: 100 });
  return (
    inboxes.find((inbox) => inbox.metadata?.user_id === userId) ??
    inboxes.find((inbox) => inbox.email.startsWith(`${username}@`)) ??
    null
  );
}

/** Creates an AgentMail inbox, or returns the existing one if username is taken. */
export async function createUserInbox(userId: string) {
  const username = inboxUsername(userId);
  try {
    return await agentmail.inboxes.create({
      username,
      metadata: { user_id: userId },
    });
  } catch (err) {
    if (err instanceof AgentMail.IsTakenError) {
      const existing = await findExistingInboxForUser(userId);
      if (existing) return existing;
    }
    throw err;
  }
}
