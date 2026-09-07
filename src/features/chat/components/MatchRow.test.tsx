import { jest, describe, it, expect } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";

import MatchRow from "@/src/features/chat/components/MatchRow";
import type { MatchListItem } from "@/src/db/queries/matches.queries";

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

jest.mock("expo-image", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: NativeView } = jest.requireActual<typeof import("react-native")>("react-native");
  const Image = (props: Record<string, unknown>) => React.createElement(NativeView, props);
  return { Image, prefetch: () => Promise.resolve(true), cacheDirectory: null };
});

jest.mock("@/components/ui/icon-symbol", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: NativeView } = jest.requireActual<typeof import("react-native")>("react-native");
  const IconSymbol = (props: Record<string, unknown>) => React.createElement(NativeView, { accessibilityLabel: String(props.name) });
  return { IconSymbol };
});

const base: MatchListItem = {
  id: "match-1",
  profileId: "p1",
  firstName: "Taylor",
  lastName: "Swift",
  photoUri: "",
  verified: false,
  lastMessageBody: null,
  lastMessageSenderId: null,
  lastMessageAt: null,
  lastMessageStatus: null,
  unreadCount: 0,
  createdAt: 0,
};

describe("MatchRow", () => {
  it("shows partner name and preview", () => {
    const match = { ...base, lastMessageBody: "Hello!" };
    const { getByText } = render(<View><MatchRow match={match} onPress={jest.fn()} /></View>);
    expect(getByText("Taylor Swift")).toBeTruthy();
    expect(getByText("Hello!")).toBeTruthy();
  });

  it("shows verified badge", () => {
    const match = { ...base, verified: true };
    const { getByLabelText } = render(<View><MatchRow match={match} onPress={jest.fn()} /></View>);
    expect(getByLabelText("checkmark.seal.fill")).toBeTruthy();
  });

  it("displays unread pill", () => {
    const match = { ...base, unreadCount: 3, lastMessageBody: "Hi" };
    const { getByText } = render(<View><MatchRow match={match} onPress={jest.fn()} /></View>);
    expect(getByText("3")).toBeTruthy();
  });

  it("calls onPress with match id", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<View><MatchRow match={base} onPress={onPress} /></View>);
    fireEvent.press(getByTestId("match-row-match-1"));
    expect(onPress).toHaveBeenCalledWith("match-1");
  });
});