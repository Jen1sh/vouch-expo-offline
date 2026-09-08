import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import { View } from "react-native";

import VoucherBrowseRow from "@/src/features/voucher/browse/components/VoucherBrowseRow";
import {
  clearUserShortlist,
  setShortlisted,
  toggleShortlist,
} from "@/src/features/voucher/browse/store/user-shortlist";
import type { CatalogBrowseItem } from "@/src/db/queries/catalog.queries";

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

// expo-image is a native view; render it as a plain View in tests.
jest.mock("expo-image", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: NativeView } = jest.requireActual<typeof import("react-native")>("react-native");
  const Image = (props: Record<string, unknown>) => React.createElement(NativeView, props);
  return { Image, prefetch: () => Promise.resolve(true), cacheDirectory: null };
});

const makeProfile = (id: string, firstName: string): CatalogBrowseItem => ({
  id,
  firstName,
  lastName: "Example",
  age: 31,
  city: "Lisbon",
  distanceKm: 12,
  verified: false,
  occupation: "Architect",
  bio: "bio",
  interests: ["coffee"],
  photoUri: `https://img.example/${id}.jpg`,
});

function Harness({ profiles }: { profiles: CatalogBrowseItem[] }) {
  return (
    <View>
      {profiles.map((profile) => (
        <VoucherBrowseRow
          key={profile.id}
          profile={profile}
          onToggleShortlist={(profileId) => toggleShortlist(profileId)}
          onPressProfile={jest.fn()}
        />
      ))}
    </View>
  );
}

describe("VoucherBrowseRow shortlist isolation (REQUIREMENTS §3.9/§4.6)", () => {
  beforeEach(() => {
    clearUserShortlist();
  });

  it("re-renders only the toggled row — sibling render counts stay flat", () => {
    const { getByTestId } = render(
      <Harness profiles={[makeProfile("a-1", "Ada"), makeProfile("b-2", "Bo")]} />
    );
    const rowA = getByTestId("voucher-browse-row-a-1");
    const rowB = getByTestId("voucher-browse-row-b-2");

    // Both rows start at a single render each.
    expect(within(rowA).getByText("\u00d71")).toBeTruthy();
    expect(within(rowB).getByText("\u00d71")).toBeTruthy();

    fireEvent.press(within(rowA).getByLabelText("Shortlist Ada"));

    // Row A: bookmark flips and its render counter advances by exactly one.
    expect(within(rowA).getByLabelText("Remove Ada from shortlist")).toBeTruthy();
    expect(within(rowA).getByText("\u00d72")).toBeTruthy();

    // Row B: untouched — same label, same single-render counter.
    expect(within(rowB).getByLabelText("Shortlist Bo")).toBeTruthy();
    expect(within(rowB).getByText("\u00d71")).toBeTruthy();
  });

  it("renders a shortlisted candidate as a selected bookmark on mount", () => {
    setShortlisted("a-1", true);
    const { getByTestId } = render(<Harness profiles={[makeProfile("a-1", "Ada")]} />);

    const bookmark = within(getByTestId("voucher-browse-row-a-1")).getByLabelText(
      "Remove Ada from shortlist"
    );
    expect(bookmark.props.accessibilityState?.selected).toBe(true);
  });

  it("reports the profile id when a row is pressed", () => {
    const onPressProfile = jest.fn();
    const { getByTestId } = render(
      <View>
        <VoucherBrowseRow
          profile={makeProfile("a-1", "Ada")}
          onToggleShortlist={jest.fn()}
          onPressProfile={onPressProfile}
        />
      </View>
    );

    fireEvent.press(getByTestId("voucher-browse-row-a-1"));
    expect(onPressProfile).toHaveBeenCalledWith("a-1");
  });
});