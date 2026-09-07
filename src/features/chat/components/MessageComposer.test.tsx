import { jest, describe, it, expect } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { View } from "react-native";

import { MessageComposer } from "@/src/features/chat/components/MessageComposer";

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

jest.mock("@/components/ui/icon-symbol", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: NativeView } = jest.requireActual<typeof import("react-native")>("react-native");
  const IconSymbol = (props: Record<string, unknown>) => React.createElement(NativeView, { accessibilityLabel: String(props.name) });
  return { IconSymbol };
});

describe("MessageComposer", () => {
  it("disables send when input is empty", () => {
    const { getByLabelText } = render(<View><MessageComposer onSend={jest.fn()} /></View>);
    const sendButton = getByLabelText("Send message");
    expect(sendButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("clears input after sending", () => {
    const onSend = jest.fn();
    const { getByLabelText, getByPlaceholderText } = render(<View><MessageComposer onSend={onSend} /></View>);
    const input = getByPlaceholderText("Message…");
    fireEvent.changeText(input, "Hello!");
    fireEvent.press(getByLabelText("Send message"));
    expect(onSend).toHaveBeenCalledWith("Hello!");
    expect(input.props.value).toBe("");
  });

  it("blocks interaction when disabled", () => {
    const { getByLabelText } = render(<View><MessageComposer onSend={jest.fn()} disabled /></View>);
    const input = getByLabelText("Message field");
    expect(input.props.editable).toBe(false);
  });
});