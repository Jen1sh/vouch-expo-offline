import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { ProfileScreen } from "@/src/features/profile/components/ProfileScreen";
import type { CatalogProfileDetail } from "@/src/db/queries/catalog.queries";
import type { DecisionDirection } from "@/src/db/schema/swipes";
import type { useProfile } from "@/src/features/profile/hooks/useProfile";

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
  (Image as unknown as { prefetch: () => Promise<boolean> }).prefetch = () => Promise.resolve(true);
  return { Image, prefetch: () => Promise.resolve(true), cacheDirectory: null };
});

// Reanimated worklets have no native module under jest; use the bundled mock
// (it keeps Animated.ScrollView usable and turns handlers into no-ops).
jest.mock("react-native-reanimated", () =>
  jest.requireActual("react-native-reanimated/mock")
);

// ProfileActionBar routes matched profiles into the chat thread via the router.
const mockRouterPush = jest.fn<(path: unknown, ...rest: unknown[]) => void>();
jest.mock("expo-router", () => ({
  router: { push: (path: unknown, ...rest: unknown[]) => mockRouterPush(path, ...rest) },
}));

// Outbox writes are side-effectful; assert that the screen routes through them.
const mockEnqueueDecision = jest.fn<
  (direction: DecisionDirection, profileId: string) => Promise<void>
>();
const mockUndoDecision = jest.fn<(profileId: string) => Promise<void>>();
jest.mock("@/src/outbox", () => ({
  enqueueDecision: (direction: DecisionDirection, profileId: string) =>
    mockEnqueueDecision(direction, profileId),
  undoDecision: (profileId: string) => mockUndoDecision(profileId),
}));

const fakeProfile: CatalogProfileDetail = {
  id: "p-1",
  firstName: "Amira",
  lastName: "Al-Farsi",
  age: 29,
  city: "Dubai",
  distanceKm: 5,
  verified: true,
  occupation: "Architect",
  bio: "Lost in the details, found in the light.",
  photoUri: "https://img.example/p-1.jpg",
  interests: ["Travel", "Film"],
  photos: ["https://img.example/p-1.jpg"],
};

// The hook is covered by its own suite; here it is a controllable source so the
// screen's rendering and action wiring stay deterministic.
const mockProfileState: {
  decision: DecisionDirection | null;
  matchedMatchId: string | null;
} = { decision: null, matchedMatchId: null };

jest.mock("@/src/features/profile/hooks/useProfile", () => ({
  useProfile: (): Pick<
    ReturnType<typeof useProfile>,
    "profile" | "status" | "decision" | "matchedMatchId" | "retry"
  > => ({
    profile: fakeProfile,
    status: "ready",
    decision: mockProfileState.decision,
    matchedMatchId: mockProfileState.matchedMatchId,
    retry: jest.fn(),
  }),
}));

describe("ProfileScreen (REQUIREMENTS §3.5)", () => {
  beforeEach(() => {
    mockProfileState.decision = null;
    mockProfileState.matchedMatchId = null;
    mockRouterPush.mockClear();
    mockEnqueueDecision.mockClear();
    mockUndoDecision.mockClear();
  });

  it("shows the profile header, bio, interests and gallery", () => {
    const view = render(<ProfileScreen profileId="p-1" />);
    expect(view.getByText(/Amira Al-Farsi/)).toBeTruthy();
    expect(view.getByText("Lost in the details, found in the light.")).toBeTruthy();
    expect(view.getByText("Travel")).toBeTruthy();
    expect(view.getByTestId("profile-gallery")).toBeTruthy();
    expect(view.getByLabelText("Photo 1 of Amira Al-Farsi")).toBeTruthy();
  });

  it("routes a like through the outbox and retracts on a second tap", () => {
    const view = render(<ProfileScreen profileId="p-1" />);

    fireEvent.press(view.getByLabelText("Like Amira"));
    expect(mockEnqueueDecision).toHaveBeenCalledWith("like", "p-1");
    expect(mockUndoDecision).not.toHaveBeenCalled();

    // Reflect the decision mirror that the (real) hook would have synced.
    mockProfileState.decision = "like";
    view.rerender(<ProfileScreen profileId="p-1" />);

    fireEvent.press(view.getByLabelText("Remove like from Amira"));
    expect(mockUndoDecision).toHaveBeenCalledWith("p-1");
  });

  it("offers an Ask-your-voucher action like Discover", () => {
    const view = render(<ProfileScreen profileId="p-1" />);
    fireEvent.press(view.getByLabelText("Ask your voucher to look at Amira"));
    expect(mockEnqueueDecision).toHaveBeenCalledWith("askVoucher", "p-1");
  });

  it("shows a Message CTA and opens the chat thread for a match", () => {
    mockProfileState.matchedMatchId = "match-42";
    const view = render(<ProfileScreen profileId="p-1" />);
    fireEvent.press(view.getByLabelText("Message Amira"));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/chat/[matchId]",
      params: { matchId: "match-42" },
    });
  });
});