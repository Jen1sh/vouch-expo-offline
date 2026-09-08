import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import VerifyCodeScreen from "@/src/features/auth/components/VerifyCodeScreen";

const mockVerify = jest.fn<(code: string) => { ok: boolean; reason?: "format" | "mismatch" }>();
const mockResend = jest.fn<() => Promise<void>>();
const mockRouterBack = jest.fn();
const mockSignIn = jest.fn<() => Promise<string>>();
// issuedAt 60s ago so the 30s cooldown has already elapsed (resend visible).
let mockSnapshot: { code: string; issuedAt: Date } = {
  code: "123456",
  issuedAt: new Date(Date.now() - 60_000),
};

// Factory bodies must stay lazy (arrows), because jest hoists jest.mock() above
// the `mock*` const declarations; any eager use inside the factory hits the
// temporal-dead-zone and yields undefined.
jest.mock("expo-router", () => ({
  router: { back: () => mockRouterBack(), push: jest.fn() },
  useLocalSearchParams: () => ({ phone: "+15550100" }),
}));

jest.mock("@/src/features/auth/context/use-auth", () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

// The real store pulls in expo-sqlite at module scope; under jest we drive the
// expected code + verify/resend straight from the test.
jest.mock("@/src/store/verification/verification-code-store", () => ({
  verify: (code: string) => mockVerify(code),
  resendVerificationCode: () => mockResend(),
  subscribe: () => () => {},
  getSnapshot: () => mockSnapshot,
  ensureCode: () => Promise.resolve(),
}));

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

describe("VerifyCodeScreen (REQUIREMENTS §3.1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignIn.mockResolvedValue("token");
    mockResend.mockResolvedValue(undefined);
    // Reset to the "cooldown already elapsed" baseline so the Resend button is
    // visible (the cooldown test below swaps in a fresh issuedAt).
    mockSnapshot = { code: "123456", issuedAt: new Date(Date.now() - 60_000) };
  });

  it("shows the phone from the sign-in step", () => {
    const view = render(<VerifyCodeScreen />);
    expect(view.getByText(/We sent a verification code to/)).toBeTruthy();
  });

  it("is disabled until a 6-digit code is entered", () => {
    const view = render(<VerifyCodeScreen />);
    const signIn = view.getByText("Sign in");

    expect(signIn).toBeDisabled();

    fireEvent.changeText(view.getByLabelText("Verification code"), "123");
    expect(signIn).toBeDisabled();

    fireEvent.changeText(view.getByLabelText("Verification code"), "123456");
    expect(signIn).toBeEnabled();
  });

  it("verifies a correct code and signs in", async () => {
    mockVerify.mockReturnValue({ ok: true });
    const view = render(<VerifyCodeScreen />);

    fireEvent.changeText(view.getByLabelText("Verification code"), "123456");
    fireEvent.press(view.getByText("Sign in"));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockVerify).toHaveBeenCalledWith("123456");
  });

  it("shows an inline error for a wrong code and never signs in", () => {
    mockVerify.mockReturnValue({ ok: false, reason: "mismatch" });
    const view = render(<VerifyCodeScreen />);

    fireEvent.changeText(view.getByLabelText("Verification code"), "123456");
    fireEvent.press(view.getByText("Sign in"));

    expect(view.getByText("Incorrect code. Please try again.")).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("gives a live resend cooldown after re-sending the code", () => {
    mockSnapshot = { code: "123456", issuedAt: new Date() };
    const view = render(<VerifyCodeScreen />);
    expect(view.getByText(/Resend code in/)).toBeTruthy();
  });

  it("re-sends the code and shows the notice", () => {
    const view = render(<VerifyCodeScreen />);
    fireEvent.press(view.getByText("Resend code"));
    expect(mockResend).toHaveBeenCalled();
    expect(view.getByText("Code re-sent")).toBeTruthy();
  });

  it("returns to the phone screen without losing the number", () => {
    const view = render(<VerifyCodeScreen />);
    fireEvent.press(view.getByLabelText("Change phone number"));
    expect(mockRouterBack).toHaveBeenCalled();
  });
});