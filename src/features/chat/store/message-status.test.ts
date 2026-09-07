import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react-native";
import {
  getMessageStatus,
  setMessageStatusMirror,
  removeMessageMirror,
  clearMessageMirror,
  useMessageStatus,
} from "@/src/features/chat/store/message-status";

beforeEach(() => {
  clearMessageMirror();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("message-status mirror", () => {
  it("getMirror returns null for unknown ids", () => {
    expect(getMessageStatus("unknown")).toBeNull();
  });

  it("setMirror/getMirror roundtrips", () => {
    setMessageStatusMirror("msg-1", "sending");
    expect(getMessageStatus("msg-1")).toBe("sending");
  });

  it("removeMirror drops the entry", () => {
    setMessageStatusMirror("msg-1", "queued");
    removeMessageMirror("msg-1");
    expect(getMessageStatus("msg-1")).toBeNull();
  });

  it("clearMessageMirror wipes all", () => {
    setMessageStatusMirror("a", "queued");
    setMessageStatusMirror("b", "sending");
    clearMessageMirror();
    expect(getMessageStatus("a")).toBeNull();
    expect(getMessageStatus("b")).toBeNull();
  });
});

describe("useMessageStatus", () => {
  it("returns null for unknown ids", () => {
    const { result } = renderHook(() => useMessageStatus("unknown"));
    expect(result.current).toBeNull();
  });

  it("updates when the mirror changes", () => {
    const { result } = renderHook(() => useMessageStatus("msg-1"));
    expect(result.current).toBeNull();
    act(() => setMessageStatusMirror("msg-1", "failed"));
    expect(result.current).toBe("failed");
  });
});