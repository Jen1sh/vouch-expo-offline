import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react-native";
import { useTyping, beginTyping } from "@/src/features/chat/store/typing";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("typing store", () => {
  it("useTyping returns false for unknown match ids", () => {
    const { result } = renderHook(() => useTyping("m"));
    expect(result.current).toBe(false);
  });

  it("beginTyping sets typing true then auto-clears after 3500ms", () => {
    const { result } = renderHook(() => useTyping("match-1"));
    expect(result.current).toBe(false);

    act(() => beginTyping("match-1"));
    expect(result.current).toBe(true);

    act(() => jest.advanceTimersByTime(3500));
    expect(result.current).toBe(false);
  });

  it("repeated calls reset the timeout", () => {
    const { result } = renderHook(() => useTyping("m"));
    act(() => beginTyping("m"));
    act(() => jest.advanceTimersByTime(3000));
    act(() => beginTyping("m")); // reset
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(true); // still typing — not cleared
    act(() => jest.advanceTimersByTime(500));
    expect(result.current).toBe(false);
  });
});