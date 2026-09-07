import { Pressable } from "react-native";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";

import Text from "@/components/Text";
import View from "@/components/View";
import { ThreadScreen } from "@/src/features/chat/components/ThreadScreen";
import { useThread } from "@/src/features/chat/hooks/useThread";

/**
 * Route container for the 1:1 chat thread. The header title is a tappable
 * avatar + name so the member can open the partner's full profile (REQUIREMENTS
 * §2.1.6) — reachable from Chat as well as Discover and Browse.
 */
export default function ChatThreadScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { partner } = useThread(matchId);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: partner
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${partner.name}'s profile`}
                  onPress={() =>
                    router.push({
                      pathname: "/profile/[userId]",
                      params: { userId: partner.profileId },
                    })
                  }>
                  <HeaderTitle
                    name={partner.name}
                    photoUri={partner.photoUri}
                  />
                </Pressable>
              )
            : "Thread",
          headerBackTitle: "Chat",
        }}
      />
      <ThreadScreen matchId={matchId} />
    </>
  );
}

function HeaderTitle({ name, photoUri }: { name: string; photoUri: string }) {
  return (
    <View style={styles.row}>
      <Image
        source={{ uri: photoUri }}
        style={styles.avatar}
        contentFit="cover"
        transition={80}
        cachePolicy="memory-disk"
      />
      <Text variant="titleMd" color="textPrimary" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = {
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
};