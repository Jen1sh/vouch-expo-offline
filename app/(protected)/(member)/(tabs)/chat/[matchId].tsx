import { Stack, useLocalSearchParams } from "expo-router";

import { ThreadScreen } from "@/src/features/chat/components/ThreadScreen";
import { useThread } from "@/src/features/chat/hooks/useThread";

export default function ChatThreadScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { partner } = useThread(matchId);

  return (
    <>
      <Stack.Screen options={{ title: partner?.name ?? "Thread", headerBackTitle: "Chat" }} />
      <ThreadScreen matchId={matchId} />
    </>
  );
}