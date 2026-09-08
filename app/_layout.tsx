import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { startOutboxWatcher } from "@/src/outbox";
import { startChatRealtime } from "@/src/features/chat/realtime/chatRealtime";
import DevPanelFab from "@/src/devpanel/DevPanelFab";
import { AppToast } from "@/src/components/AppToast";
import { AuthProvider } from "@/src/features/auth/context/AuthProvider";
import { useAuth } from "@/src/features/auth/context/use-auth";
import { useSettingsBridge } from "@/src/features/settings/hooks/useSettingsBridge";
import { useSettings } from "@/src/features/settings/store/settings";
import { AppModeProvider } from "@/src/store/mode/AppModeProvider";
import "@/src/theme/unistyles";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(protected)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { themeMode } = useSettings();
  useSettingsBridge();

  useEffect(() => {
    startOutboxWatcher();
    startChatRealtime();
  }, []);

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

  // `themeMode` ("system" | "light" | "dark") decides the navigation chrome;
  // falls back to the OS scheme when following the system.
  const effectiveScheme = themeMode === "system" ? colorScheme : themeMode;
  const navigationTheme = effectiveScheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <AuthProvider>
          <AppModeProvider>
            <AppNavigator />
          </AppModeProvider>
        </AuthProvider>
        <DevPanelFab />
        <AppToast />
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const { status, onboardingStatus } = useAuth();
  const { language } = useSettings();

  useEffect(() => {
    if (status !== "unknown" && (status === "signedOut" || onboardingStatus !== "unknown")) {
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

      <Stack.Screen name="dev-panel" options={{ presentation: "modal", headerShown: false }} />
    </Stack>
  );
}
