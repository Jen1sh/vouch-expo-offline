import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";

import { VouchNoteEditor, VOUCH_NOTE_MAX_LENGTH } from "@/src/features/voucher/shortlist/components/VouchNoteEditor";
import { enqueueUpdateVouchNote } from "@/src/outbox";
import { showAppToast } from "@/src/components/AppToast";

jest.mock("react-native-unistyles", () => {
  const { light } = jest.requireActual("@/src/theme/themes/light") as typeof import("@/src/theme/themes/light");
  const THEME = light;
  return {
    StyleSheet: {
      create: (def: unknown) => (typeof def === "function" ? def(THEME) : def),
      configure: () => {},
      flatten: (styles: unknown) => styles,
      compose: <A extends object, B extends object>(a: A, b: B) => ({ ...a, ...b }),
      absoluteFillObject: {},
      absoluteFill: {},
      hairlineWidth: 1,
    },
    UnistylesRuntime: {
      themeName: "light",
      colorScheme: "light",
      getTheme: () => THEME,
      setTheme: () => {},
      setAdaptiveThemes: () => {},
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    },
    useUnistyles: () => ({ theme: THEME, rt: {} }),
  };
});

jest.mock("@/src/outbox", () => ({
  enqueueUpdateVouchNote: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/src/components/AppToast", () => ({
  showAppToast: jest.fn(),
}));

const mockedEnqueue = jest.mocked(enqueueUpdateVouchNote);
const mockedToast = jest.mocked(showAppToast);

describe("VouchNoteEditor (REQUIREMENTS §3.9 — durable note)", () => {
  beforeEach(() => {
    mockedEnqueue.mockClear();
    mockedToast.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the persisted note and enqueues the debounced latest write", async () => {
    const { getByTestId } = render(
      <VouchNoteEditor profileId="a-1" note="Initial note" profileName="Ada" />
    );

    const input = getByTestId("vouch-note-input-a-1");
    expect(input.props.value).toBe("Initial note");

    fireEvent.changeText(input, "Updated note");
    expect(mockedEnqueue).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    expect(mockedEnqueue).toHaveBeenCalledWith("a-1", "Updated note");
    expect(mockedToast).toHaveBeenCalledWith("success", "Note saved");
  });

  it("collapses rapid keystrokes into a single write of the newest text", async () => {
    const { getByTestId } = render(<VouchNoteEditor profileId="a-1" note="" profileName="Ada" />);

    const input = getByTestId("vouch-note-input-a-1");
    fireEvent.changeText(input, "a");
    fireEvent.changeText(input, "ab");
    fireEvent.changeText(input, "abc");

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    expect(mockedEnqueue).toHaveBeenCalledWith("a-1", "abc");
  });

  it("locks the input to the max length and shows the depth confirmation at 140 chars", () => {
    const { getByTestId, getByText } = render(
      <VouchNoteEditor profileId="a-1" note="" profileName="Ada" />
    );

    const input = getByTestId("vouch-note-input-a-1");
    expect(input.props.maxLength).toBe(VOUCH_NOTE_MAX_LENGTH);
    expect(input.props.maxLength).toBe(200);

    expect(getByText("0/200")).toBeTruthy();
    fireEvent.changeText(input, "x".repeat(150));
    expect(getByText("150/200")).toBeTruthy();
    expect(getByText("Thoughtful voucher depth reached")).toBeTruthy();
  });
});