import { describe, it, expect } from "@jest/globals";
import {
  newestFirst,
  mergeNewest,
  appendOlder,
  withStatus,
  withoutMessage,
  type ThreadMessage,
} from "@/src/features/chat/model/thread";

function msg(partial: Partial<ThreadMessage> & Pick<ThreadMessage, "id">): ThreadMessage {
  return {
    matchId: "m",
    body: "",
    senderId: "someone",
    status: "sent",
    outboxItemId: null,
    createdAt: 0,
    ...partial,
  };
}

describe("newestFirst", () => {
  it("orders descending by createdAt then id", () => {
    const items = [
      msg({ id: "a", createdAt: 100, body: "older" }),
      msg({ id: "b", createdAt: 200, body: "newer" }),
      msg({ id: "c", createdAt: 200, body: "same ts" }),
    ];
    expect(newestFirst(items).map((m) => m.id)).toEqual(["c", "b", "a"]);
  });
});

describe("mergeNewest", () => {
  it("prepends incoming pages deduped by id", () => {
    const prev = [
      msg({ id: "old-2", createdAt: 10 }),
      msg({ id: "old-1", createdAt: 5 }),
    ];
    // Incoming arrives already newest-first from the keyset query.
    const incoming = [
      msg({ id: "new-1", createdAt: 30, body: "newest" }),
      msg({ id: "dup", createdAt: 20, body: "updated" }),
    ];
    const result = mergeNewest(prev, incoming);
    expect(result.map((m) => m.id)).toEqual(["new-1", "dup", "old-2", "old-1"]);
    expect(result.find((m) => m.id === "dup")?.body).toBe("updated");
  });

  it("incoming order is authoritative (query is already newest-first)", () => {
    const prev = [msg({ id: "old", createdAt: 10 })];
    const incoming = [msg({ id: "a", createdAt: 20 }), msg({ id: "b", createdAt: 30 })];
    expect(mergeNewest(prev, incoming).map((m) => m.id)).toEqual(["a", "b", "old"]);
  });
});

describe("appendOlder", () => {
  it("appends and reorders", () => {
    const prev = [msg({ id: "newer", createdAt: 20 })];
    const older = [msg({ id: "older", createdAt: 10 })];
    const result = appendOlder(prev, older);
    expect(result.map((m) => m.id)).toEqual(["newer", "older"]);
  });

  it("drops older-page rows already held (older never overrides)", () => {
    const prev = [msg({ id: "dup", createdAt: 10, body: "old" })];
    const older = [msg({ id: "dup", createdAt: 10, body: "updated" })];
    const result = appendOlder(prev, older);
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe("old");
  });
});

describe("withStatus", () => {
  it("replaces matching message", () => {
    const prev = [
      msg({ id: "a", status: "queued" }),
      msg({ id: "b", status: "sent" }),
    ];
    const result = withStatus(prev, "a", "failed");
    expect(result[0].status).toBe("failed");
    expect(result[1].status).toBe("sent");
  });
});

describe("withoutMessage", () => {
  it("removes by id", () => {
    const prev = [msg({ id: "a" }), msg({ id: "b" })];
    expect(withoutMessage(prev, "a").map((m) => m.id)).toEqual(["b"]);
  });
});