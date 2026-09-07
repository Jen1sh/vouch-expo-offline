import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";

import { MessageBubble } from "@/src/features/chat/components/MessageBubble";
import { clearMessageMirror } from "@/src/features/chat/store/message-status";
import type { ThreadMessage } from "@/src/features/chat/model/thread";

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

beforeEach(() => clearMessageMirror());

function makeMessage(partial: Partial<ThreadMessage> & Pick<ThreadMessage, "id">): ThreadMessage {
  return { matchId: "m1", body: "Hello", senderId: "me", status: "sent", outboxItemId: null, createdAt: 0, ...partial };
}

describe("MessageBubble", () => {
  it("shows body text", () => {
    const msg = makeMessage({ id: "a", body: "Hi there", createdAt: 0 });
    const { getByText } = render(<View><MessageBubble message={msg} /></View>);
    expect(getByText("Hi there")).toBeTruthy();
  });

  it("shows 'Sent' caption for sent outgoing", () => {
    const msg = makeMessage({ id: "a", createdAt: 0, status: "sent" });
    const { getByText } = render(<View><MessageBubble message={msg} /></View>);
    expect(getByText("Sent")).toBeTruthy();
  });

  it("shows Retry and Delete buttons when failed", () => {
    const msg = makeMessage({ id: "a", createdAt: 0, status: "failed" });
    const { getByText } = render(
      <View>
        <MessageBubble message={msg} onRetry={jest.fn()} onDelete={jest.fn()} />
      </View>
    );
    expect(getByText("Retry")).toBeTruthy();
    expect(getByText("Delete")).toBeTruthy();
  });

  it("fires onRetry when Retry pressed", () => {
    const onRetry = jest.fn();
    const msg = makeMessage({ id: "msg-1", createdAt: 0, status: "failed" });
    const { getByLabelText } = render(
      <View>
        <MessageBubble message={msg} onRetry={onRetry} onDelete={jest.fn()} />
      </View>
    );
    fireEvent.press(getByLabelText("Retry message msg-1"));
    expect(onRetry).toHaveBeenCalledWith("msg-1");
  });
});