import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "@/src/features/auth/context/AuthProvider";
import { useAuth } from "@/src/features/auth/context/use-auth";
import "@/src/theme/unistyles";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
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
        <AppNavigator />
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function AppNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const isInAuthGroup = segments[0] === "(auth)";
    if (status === "signedOut" && !isInAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (status === "signedIn" && isInAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [status, segments, router]);

  useEffect(() => {
    if (status !== "unknown") {
      SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === "unknown") {
    return null;
  }

  return (
    <Stack>
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Screen
        name="modal"
        options={{ presentation: "modal", title: "Modal" }}
      />
    </Stack>
  );
}
