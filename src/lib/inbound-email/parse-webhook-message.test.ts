import { describe, expect, it } from "vitest";
import { parseWebhookMessage } from "./parse-webhook-message";

describe("parseWebhookMessage", () => {
  it("reads the snake_case body AgentMail actually sends", () => {
    const parsed = parseWebhookMessage({
      inbox_id: "inv-3c4f0757@agentmail.to",
      message_id: "<abc@email.amazonses.com>",
      subject: "Fwd: X.AI invoice CQN8-8WLV-Y3RB",
      text: "Test forwarding #2: X.AI invoice attached.",
      extracted_text: "ignored when text exists",
      attachments: [
        {
          attachment_id: "b84d8796",
          content_type: "application/pdf",
          filename: "xai-invoice.pdf",
          size: 46225,
        },
      ],
    });

    expect(parsed).toEqual({
      inboxId: "inv-3c4f0757@agentmail.to",
      messageId: "<abc@email.amazonses.com>",
      subject: "Fwd: X.AI invoice CQN8-8WLV-Y3RB",
      text: "Test forwarding #2: X.AI invoice attached.",
      html: null,
      attachments: [
        {
          attachmentId: "b84d8796",
          filename: "xai-invoice.pdf",
          contentType: "application/pdf",
          size: 46225,
        },
      ],
    });
  });

  it("also accepts camelCase fields", () => {
    const parsed = parseWebhookMessage({
      inboxId: "i",
      messageId: "m",
      extractedHtml: "<p>hi</p>",
      attachments: [{ attachmentId: "a", contentType: "image/png" }],
    });

    expect(parsed).toMatchObject({
      inboxId: "i",
      messageId: "m",
      html: "<p>hi</p>",
      attachments: [{ attachmentId: "a", contentType: "image/png", filename: null, size: null }],
    });
  });

  it("falls back to extracted_text when text is absent", () => {
    expect(
      parseWebhookMessage({ inbox_id: "i", message_id: "m", extracted_text: "body" })?.text,
    ).toBe("body");
  });

  it("returns null without an inbox or message id", () => {
    expect(parseWebhookMessage({ message_id: "m" })).toBeNull();
    expect(parseWebhookMessage({ inbox_id: "i" })).toBeNull();
    expect(parseWebhookMessage(null)).toBeNull();
    expect(parseWebhookMessage("nope")).toBeNull();
  });

  it("drops attachments without an id and tolerates a missing list", () => {
    const parsed = parseWebhookMessage({
      inbox_id: "i",
      message_id: "m",
      attachments: [{ filename: "x.pdf" }, "junk"],
    });
    expect(parsed?.attachments).toEqual([]);
    expect(parseWebhookMessage({ inbox_id: "i", message_id: "m" })?.attachments).toEqual([]);
  });
});
