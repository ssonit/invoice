import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockCreate, mockList, MockIsTakenError } = vi.hoisted(() => {
  class MockIsTakenError extends Error {}
  return { mockCreate: vi.fn(), mockList: vi.fn(), MockIsTakenError };
});

vi.mock("agentmail", () => ({
  AgentMailClient: class {
    inboxes = { create: mockCreate, list: mockList };
  },
  AgentMail: { IsTakenError: MockIsTakenError },
}));

import { createUserInbox } from "./agentmail";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createUserInbox", () => {
  it("creates a new inbox with a deterministic username and metadata", async () => {
    mockCreate.mockResolvedValue({ email: "inv-12345678@agentmail.to" });
    const result = await createUserInbox("12345678-aaaa-bbbb-cccc-000000000000");
    expect(mockCreate).toHaveBeenCalledWith({
      username: "inv-12345678",
      metadata: { user_id: "12345678-aaaa-bbbb-cccc-000000000000" },
    });
    expect(result).toEqual({ email: "inv-12345678@agentmail.to" });
  });

  it("falls back to the existing inbox (matched by metadata) when the username is taken", async () => {
    mockCreate.mockRejectedValue(new MockIsTakenError("taken"));
    mockList.mockResolvedValue({
      inboxes: [
        { email: "inv-12345678@agentmail.to", metadata: { user_id: "user-1" } },
        { email: "other@agentmail.to", metadata: {} },
      ],
    });
    const result = await createUserInbox("user-1");
    expect(result).toEqual({
      email: "inv-12345678@agentmail.to",
      metadata: { user_id: "user-1" },
    });
  });

  it("falls back to matching by email prefix when no metadata match exists", async () => {
    mockCreate.mockRejectedValue(new MockIsTakenError("taken"));
    mockList.mockResolvedValue({
      inboxes: [{ email: "inv-abcdefgh@agentmail.to", metadata: {} }],
    });
    const result = await createUserInbox("abcdefgh-xxxx");
    expect(result).toEqual({ email: "inv-abcdefgh@agentmail.to", metadata: {} });
  });

  it("re-throws IsTakenError when no matching existing inbox can be found", async () => {
    mockCreate.mockRejectedValue(new MockIsTakenError("taken"));
    mockList.mockResolvedValue({ inboxes: [] });
    await expect(createUserInbox("user-1")).rejects.toBeInstanceOf(MockIsTakenError);
  });

  it("re-throws non-IsTakenError errors without attempting a fallback lookup", async () => {
    mockCreate.mockRejectedValue(new Error("network error"));
    await expect(createUserInbox("user-1")).rejects.toThrow("network error");
    expect(mockList).not.toHaveBeenCalled();
  });
});
