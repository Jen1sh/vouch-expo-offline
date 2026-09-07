import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { ProfileGallery } from "@/src/features/profile/components/ProfileGallery";

// Unistyles is a native binding; swap it for a test double so the themed
// StyleSheet.create callbacks run against the real light theme tokens.
jest.mock("react-native-unistyles", () => {
  const { light } = jest.requireActual<typeof import("@/src/theme/themes/light")>("@/src/theme/themes/light");
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

// expo-image is a native view; render it as a plain View in tests.
jest.mock("expo-image", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: NativeView } = jest.requireActual<typeof import("react-native")>("react-native");
  const Image = (props: Record<string, unknown>) => React.createElement(NativeView, props);
  // The real expo-image exposes `prefetch` as a static on the component.
  (Image as unknown as { prefetch: () => Promise<boolean> }).prefetch = () => Promise.resolve(true);
  return { Image, prefetch: () => Promise.resolve(true), cacheDirectory: null };
});

const PHOTOS = [
  "https://img.example/a-1.jpg",
  "https://img.example/a-2.jpg",
  "https://img.example/a-3.jpg",
];

describe("ProfileGallery (REQUIREMENTS §3.5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders every photo in seed order", () => {
    const { getAllByLabelText } = render(<ProfileGallery photos={PHOTOS} profileName="Amira Al-Farsi" />);
    const photos = getAllByLabelText(/^Photo \d+ of Amira Al-Farsi$/);
    expect(photos.map((photo) => photo.props.source.uri)).toEqual(PHOTOS);
  });

  it("shows one dot per photo with the first active", () => {
    const { getByTestId, queryByTestId } = render(
      <ProfileGallery photos={PHOTOS} profileName="Amira Al-Farsi" />
    );
    expect(getByTestId("gallery-dot-active-0")).toBeTruthy();
    expect(queryByTestId("gallery-dot-1")).toBeTruthy();
    expect(queryByTestId("gallery-dot-2")).toBeTruthy();
  });

  it("advances the active dot when the page changes", () => {
    const { getByTestId } = render(
      <ProfileGallery photos={PHOTOS} profileName="Amira Al-Farsi" />
    );
    const gallery = getByTestId("profile-gallery");
    fireEvent(gallery, "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: 375 } },
    });
    expect(getByTestId("gallery-dot-active-1")).toBeTruthy();
  });
});