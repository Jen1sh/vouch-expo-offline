import { useState, type ReactNode } from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import BrowseFilterBar from "@/src/features/browse/components/BrowseFilterBar";
import { EMPTY_FILTERS, type BrowseFilters } from "@/src/features/browse/model/browseFilters";

// Unistyles is a native binding; swap it for a test double so the themed
// StyleSheet.create callbacks run against the real light theme tokens.
jest.mock("react-native-unistyles", () => {
  const { light } = jest.requireActual("@/src/theme/themes/light") as typeof import("@/src/theme/themes/light");
  const THEME = light;
  return {
    StyleSheet: {
      create: (def: unknown) =>
        typeof def === "function" ? def(THEME) : def,
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

// The RN Modal host is a native view; in the test tree it renders children
// synchronously, so the sheet's controls are queryable while visible.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
}));
function Harness() {
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_FILTERS);
  return (
    <BrowseFilterBar
      filters={filters}
      onChange={setFilters}
      onReset={() => setFilters(EMPTY_FILTERS)}
    />
  );
}

describe("BrowseFilterBar bottom sheet (REQUIREMENTS §3.4)", () => {
  it("is a closed trigger that opens the filter sheet", () => {
    const view = render(<Harness />);
    expect(view.queryByLabelText("Within 25 kilometres")).toBeNull();

    fireEvent.press(view.getByLabelText("Show filters"));
    expect(view.getByLabelText("Within 25 kilometres")).toBeTruthy();
    expect(view.getByRole("switch")).toBeTruthy();
  });

  it("adjusts the age range from inside the sheet", () => {
    const view = render(<Harness />);
    fireEvent.press(view.getByLabelText("Show filters"));

    fireEvent.press(view.getByLabelText("Increase from age"));
    expect(view.getByText("19")).toBeTruthy();
  });

  it("selects and resets a distance chip from inside the sheet", () => {
    const view = render(<Harness />);
    fireEvent.press(view.getByLabelText("Show filters"));

    expect(view.getByLabelText("Within 25 kilometres").props.accessibilityState?.selected).toBe(false);

    fireEvent.press(view.getByLabelText("Within 25 kilometres"));
    expect(view.getByLabelText("Within 25 kilometres").props.accessibilityState?.selected).toBe(true);
    expect(view.getAllByLabelText("Reset all filters")).toBeTruthy();

    fireEvent.press(view.getAllByLabelText("Reset all filters")[0]);
    expect(view.getByLabelText("Within 25 kilometres").props.accessibilityState?.selected).toBe(false);
  });

  it("toggles the verified-only switch inside the sheet", () => {
    const view = render(<Harness />);
    fireEvent.press(view.getByLabelText("Show filters"));

    const toggle = view.getByRole("switch");
    expect(toggle.props.value).toBe(false);
    fireEvent(toggle, "valueChange", true);
    expect(toggle.props.value).toBe(true);
  });

  it("closes the sheet with Done", () => {
    const view = render(<Harness />);
    fireEvent.press(view.getByLabelText("Show filters"));

    fireEvent.press(view.getByLabelText("Done"));
    expect(view.queryByLabelText("Within 25 kilometres")).toBeNull();
  });

  it("closes the sheet by tapping the scrim", () => {
    const view = render(<Harness />);
    fireEvent.press(view.getByLabelText("Show filters"));

    fireEvent.press(view.getByLabelText("Close filters"));
    expect(view.queryByLabelText("Within 25 kilometres")).toBeNull();
  });
});