import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { useAuth } from "@/src/features/auth/context/use-auth";

/**
 * Signed-in, post-auth stack. Holds the splash screen until the durable
 * profile is read, then shows onboarding or the tabs (never both). The
 * onboarding screens are only ever rendered while incomplete.
 */
export default function ProtectedLayout() {
  const { onboardingStatus } = useAuth();

  useEffect(() => {
    if (onboardingStatus !== "unknown") {
      SplashScreen.hideAsync();
    }
  }, [onboardingStatus]);

  if (onboardingStatus === "unknown") {
    return null;
  }

  return (
    <Stack>
      <Stack.Protected guard={onboardingStatus === "complete"}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={onboardingStatus === "incomplete"}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}