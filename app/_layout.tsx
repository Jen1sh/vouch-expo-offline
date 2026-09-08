import "@/src/theme/unistyles";
import { ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { AppToast } from "@/src/components/AppToast";
import DevPanelFab from "@/src/devpanel/DevPanelFab";
import { AuthProvider } from "@/src/features/auth/context/AuthProvider";
import { useAuth } from "@/src/features/auth/context/use-auth";
import { startChatRealtime } from "@/src/features/chat/realtime/chatRealtime";
import { useSettingsBridge } from "@/src/features/settings/hooks/useSettingsBridge";
import { useSettings } from "@/src/features/settings/store/settings";
import { startOutboxWatcher } from "@/src/outbox";
import { AppModeProvider } from "@/src/store/mode/AppModeProvider";
import {
  darkNavigationTheme,
  getTheme,
  lightNavigationTheme,
  StyleSheet,
  UnistylesRuntime,
  useUnistyles,
} from "@/src/theme";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(protected)",
};

export default function RootLayout() {
  // Single theme channel: unistyles is the one source of truth. The nav
  // chrome + status bar read the active theme name out of the unistyles
  // runtime (see `navigation.ts`), so the frame and the content flip together.
  const { rt } = useUnistyles();
  const isDark = rt.themeName === "dark";
  useSettingsBridge();

  useEffect(() => {
    startOutboxWatcher();
    startChatRealtime();
  }, []);

  // Paint the window/root background with the active surface so the
  // safe-area band and any edge-to-edge gaps always match the screens.
  useEffect(() => {
    UnistylesRuntime.setRootViewBackgroundColor(getTheme().colors.background);
  }, [isDark]);

  const [fontsLoaded, fontError] = useFonts({
    "Newsreader-Regular": require("@/assets/fonts/Newsreader_9pt-Regular.ttf"),
    "Newsreader-Medium": require("@/assets/fonts/Newsreader_9pt-Medium.ttf"),
    "Newsreader-SemiBold": require("@/assets/fonts/Newsreader_9pt-SemiBold.ttf"),
    "Newsreader-Bold": require("@/assets/fonts/Newsreader_9pt-Bold.ttf"),
    "PlusJakartaSans-Regular": require("@/assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("@/assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("@/assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("@/assets/fonts/PlusJakartaSans-Bold.ttf"),
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const navigationTheme = isDark ? darkNavigationTheme : lightNavigationTheme;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <ThemeProvider value={navigationTheme}>
            <AuthProvider>
              <AppModeProvider>
                <AppNavigator />
              </AppModeProvider>
            </AuthProvider>
            <DevPanelFab />
            <AppToast />
            <StatusBar style={isDark ? "light" : "dark"} />
          </ThemeProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const { status, onboardingStatus } = useAuth();
  const { language } = useSettings();

  useEffect(() => {
    if (
      status !== "unknown" &&
      (status === "signedOut" || onboardingStatus !== "unknown")
    ) {
      SplashScreen.hideAsync();
    }
  }, [status, onboardingStatus]);

  if (status === "unknown") {
    return null;
  }

  // `key={language}` remounts the navigator when the language flips so the
  // whole tree reflows against the new I18nManager direction (§3.8 RTL).
  return (
    <Stack key={language}>
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(protected)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Screen
        name="dev-panel"
        options={{ presentation: "modal", headerShown: false }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
