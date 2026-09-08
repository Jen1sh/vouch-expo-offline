import { useState } from "react";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { TrueSheet } from "@lodev09/react-native-true-sheet";

import BrowseFilterBar from "@/src/features/browse/components/BrowseFilterBar";
import { EMPTY_FILTERS, type BrowseFilters } from "@/src/features/browse/model/browseFilters";

// TrueSheet is mocked globally in jest.setup.js (its /mock renders children as
// a plain View and records instance present()/dismiss() as jest.fn). The mock's
// static `instances` registry isn't in the real lib's typings, hence the cast.
const trueSheetMockEntries = (TrueSheet as unknown as {
  instances: Record<string, { present: jest.Mock; dismiss: jest.Mock }>;
}).instances;

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("presents the true-sheet when the trigger is pressed", () => {
    const view = render(<Harness />);
    expect(trueSheetMockEntries["browse-filters"].present).not.toHaveBeenCalled();

    fireEvent.press(view.getByLabelText("Show filters"));
    expect(trueSheetMockEntries["browse-filters"].present).toHaveBeenCalled();
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

    expect(view.getByLabelText("Within 25 kilometres").props.accessibilityState?.selected).toBe(false);

    fireEvent.press(view.getByLabelText("Within 25 kilometres"));
    expect(view.getByLabelText("Within 25 kilometres").props.accessibilityState?.selected).toBe(true);
    expect(view.getAllByLabelText("Reset all filters")).toBeTruthy();

    fireEvent.press(view.getAllByLabelText("Reset all filters")[0]);
    expect(view.getByLabelText("Within 25 kilometres").props.accessibilityState?.selected).toBe(false);
  });

  it("toggles the verified-only switch inside the sheet", () => {
    const view = render(<Harness />);

    const toggle = view.getByRole("switch");
    expect(toggle.props.value).toBe(false);
    fireEvent(toggle, "valueChange", true);
    expect(toggle.props.value).toBe(true);
  });

  it("closes the sheet with Done", () => {
    const view = render(<Harness />);
    fireEvent.press(view.getByLabelText("Show filters"));

    fireEvent.press(view.getByLabelText("Done"));
    expect(trueSheetMockEntries["browse-filters"].dismiss).toHaveBeenCalled();
  });
});