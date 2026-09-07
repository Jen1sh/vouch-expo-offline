import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { useAuth } from "@/src/features/auth/context/use-auth";
import { useAppMode } from "@/src/store/mode/AppModeProvider";

/**
 * Signed-in, post-auth stack. Holds the splash screen until the durable
 * profile is read, then shows onboarding or one of the two navigation trees —
 * never both. Which tree is active is decided by the member/voucher switch
 * held in Settings (§3.7): the `(member)` and `(voucher)` groups are mutually
 * exclusive here, which is what makes the voucher tree incapable of reaching a
 * 1:1 chat route in the first place.
 */
export default function ProtectedLayout() {
  const { onboardingStatus } = useAuth();
  const { mode } = useAppMode();

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
      <Stack.Protected guard={onboardingStatus === "complete" && mode === "member"}>
        <Stack.Screen name="(member)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={onboardingStatus === "complete" && mode === "voucher"}>
        <Stack.Screen name="(voucher)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={onboardingStatus === "incomplete"}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}