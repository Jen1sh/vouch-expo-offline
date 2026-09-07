import { Stack } from "expo-router";

import { useTheme } from "@/src/theme";

/** Chat stack: matches list -> thread. Owns its headers inside the tab. */
export default function ChatLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[matchId]"
        options={{ title: "Thread", headerBackTitle: "Chat" }}
      />
    </Stack>
  );
}