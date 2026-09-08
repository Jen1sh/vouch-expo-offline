import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import SettingsScreen from "@/src/features/settings/components/SettingsScreen";
import { AppModeProvider } from "@/src/store/mode/AppModeProvider";
import {
  setLanguage,
  setNotificationsEnabled,
  setThemeMode,
} from "@/src/features/settings/writes";
import { showAppToast } from "@/src/components/AppToast";
import { wipeLocalData } from "@/src/outbox";

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

const mockSignOut = jest.fn();
jest.mock("@/src/features/auth/context/use-auth", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

jest.mock("@/src/features/settings/writes", () => ({
  setThemeMode: jest.fn(() => Promise.resolve()),
  setLanguage: jest.fn(() => Promise.resolve()),
  setNotificationsEnabled: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/src/outbox", () => ({
  wipeLocalData: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/src/components/AppToast", () => ({
  showAppToast: jest.fn(),
}));

const mockedSetThemeMode = jest.mocked(setThemeMode);
const mockedSetLanguage = jest.mocked(setLanguage);
const mockedSetNotificationsEnabled = jest.mocked(setNotificationsEnabled);
const mockedSignOut = jest.mocked(mockSignOut);

function renderScreen() {
  return render(
    <AppModeProvider>
      <SettingsScreen />
    </AppModeProvider>
  );
}

describe("SettingsScreen (REQUIREMENTS §3.8)", () => {
  beforeEach(() => {
    mockedSetThemeMode.mockClear();
    mockedSetLanguage.mockClear();
    mockedSetNotificationsEnabled.mockClear();
    mockedSignOut.mockClear();
    jest.mocked(showAppToast).mockClear();
    jest.mocked(wipeLocalData).mockClear();
  });

  it("renders the mode, appearance, language and notifications controls", () => {
    const { getByText, getByLabelText } = renderScreen();

    expect(getByText("Settings")).toBeTruthy();
    // Mode cards.
    expect(getByText("Member")).toBeTruthy();
    expect(getByText("Voucher")).toBeTruthy();
    // Theme chips — System preselected.
    expect(getByText("Light")).toBeTruthy();
    expect(getByText("Dark")).toBeTruthy();
    expect(getByText("System")).toBeTruthy();
    // Language chips.
    expect(getByText("English")).toBeTruthy();
    expect(getByText("العربية")).toBeTruthy();
    // Notifications toggle off by default.
    const notifications = getByLabelText("Notifications");
    expect(notifications.props.accessibilityRole).toBe("switch");
    // Sign out.
    expect(getByText("Sign out")).toBeTruthy();
  });

  it("switching mode flips the badge through the provider", () => {
    const { queryByText, getByText } = renderScreen();
    expect(queryByText("Voucher mode")).toBeNull();

    fireEvent.press(getByText("Voucher"));

    expect(getByText("Voucher mode")).toBeTruthy();
  });

  it("a theme chip write goes through the durable settings write path", () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText("Dark"));
    expect(mockedSetThemeMode).toHaveBeenCalledWith("dark");
  });

  it("a language chip write goes through the durable settings write path", () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText("العربية"));
    expect(mockedSetLanguage).toHaveBeenCalledWith("ar");
  });

  it("toggling notifications writes the enabled flag", () => {
    const { getByLabelText } = renderScreen();
    fireEvent(getByLabelText("Notifications"), "valueChange", true);
    expect(mockedSetNotificationsEnabled).toHaveBeenCalledWith(true);
  });

  it("signs the account out", () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText("Sign out"));
    expect(mockedSignOut).toHaveBeenCalledTimes(1);
  });
});