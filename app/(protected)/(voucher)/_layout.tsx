import { Stack } from "expo-router";

/**
 * Voucher navigation tree (see REQUIREMENTS §2.2 / §3.7 / §3.9). Structurally
 * incapable of reaching a 1:1 chat: the tabs are Browse / Shortlist /
 * Settings only, and the only pushed routes are the candidate detail screen and
 * the three-way repair thread. The chat send/read services must independently
 * refuse voucher-mode callers too — that second line of defense arrives with
 * the chat/outbox build.
 */
export default function VoucherLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="candidate/[userId]"
        options={{ title: "Candidate", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="thread/[vouchId]"
        options={{ title: "Thread", headerBackTitle: "Back" }}
      />
    </Stack>
  );
}