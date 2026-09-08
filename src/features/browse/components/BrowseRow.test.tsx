import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import { View } from "react-native";

import BrowseRow from "@/src/features/browse/components/BrowseRow";
import {
  clearUserSwipes,
  setDecision,
  toggleLike,
} from "@/src/features/browse/store/user-swipes";
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
        <BrowseRow
          key={profile.id}
          profile={profile}
          onToggleLike={(profileId) => toggleLike(profileId)}
          onPressProfile={jest.fn()}
        />
      ))}
    </View>
  );
}

describe("BrowseRow like-state isolation (REQUIREMENTS §3.4/§4.6)", () => {
  beforeEach(() => {
    clearUserSwipes();
  });

  it("re-renders only the toggled row — sibling render counts stay flat", () => {
    const { getByTestId } = render(<Harness profiles={[makeProfile("a-1", "Ada"), makeProfile("b-2", "Bo")]} />);
    const rowA = getByTestId("browse-row-a-1");
    const rowB = getByTestId("browse-row-b-2");

    // Both rows start at a single render each.
    expect(within(rowA).getByText(/re-render \u00d71$/)).toBeTruthy();
    expect(within(rowB).getByText(/re-render \u00d71$/)).toBeTruthy();

    fireEvent.press(within(rowA).getByLabelText("Like Ada"));

    // Row A: heart flips and its render counter advances by exactly one.
    expect(within(rowA).getByLabelText("Remove like from Ada")).toBeTruthy();
    expect(within(rowA).getByText(/re-render \u00d72$/)).toBeTruthy();

    // Row B: untouched — same label, same single-render counter.
    expect(within(rowB).getByLabelText("Like Bo")).toBeTruthy();
    expect(within(rowB).getByText(/re-render \u00d71$/)).toBeTruthy();
  });

  it("renders a persisted like as a selected heart on mount", () => {
    setDecision("a-1", "like");
    const { getByTestId } = render(<Harness profiles={[makeProfile("a-1", "Ada")]} />);

    const like = within(getByTestId("browse-row-a-1")).getByLabelText("Remove like from Ada");
    expect(like.props.accessibilityState?.selected).toBe(true);
  });

  it("reports the profile id when a row is pressed", () => {
    const onPressProfile = jest.fn();
    const { getByTestId } = render(
      <View>
        <BrowseRow
          profile={makeProfile("a-1", "Ada")}
          onToggleLike={jest.fn()}
          onPressProfile={onPressProfile}
        />
      </View>
    );

    fireEvent.press(getByTestId("browse-row-a-1"));
    expect(onPressProfile).toHaveBeenCalledWith("a-1");
  });
});