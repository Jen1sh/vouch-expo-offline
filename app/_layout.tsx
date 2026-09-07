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
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import DevPanelFab from "@/src/devpanel/DevPanelFab";
import { AuthProvider } from "@/src/features/auth/context/AuthProvider";
import { useAuth } from "@/src/features/auth/context/use-auth";
import { AppModeProvider } from "@/src/store/mode/AppModeProvider";
import "@/src/theme/unistyles";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(protected)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

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

  const navigationTheme = colorScheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        <AppModeProvider>
          <AppNavigator />
        </AppModeProvider>
      </AuthProvider>
      <DevPanelFab />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function AppNavigator() {
  const { status, onboardingStatus } = useAuth();

  useEffect(() => {
    if (status !== "unknown" && (status === "signedOut" || onboardingStatus !== "unknown")) {
      SplashScreen.hideAsync();
    }
  }, [status, onboardingStatus]);

  if (status === "unknown") {
    return null;
  }

  return (
    <Stack>
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
