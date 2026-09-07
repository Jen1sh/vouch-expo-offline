import { Stack } from "expo-router";

/**
 * Member navigation tree (see REQUIREMENTS §2.1 / §3). Hosts the four tabs and
 * the pushed profile detail route in one stack so `/profile/[userId]` slides
 * over the tab bar from Discover or Browse.
 */
export default function MemberLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile/[userId]"
        options={{ title: "Profile", headerBackTitle: "Back" }}
      />
    </Stack>
  );
}