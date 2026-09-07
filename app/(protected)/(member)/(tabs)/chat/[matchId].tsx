import { useLocalSearchParams } from 'expo-router';

import PlaceholderScreen from '@/components/placeholder-screen';

export default function ChatThreadScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  return (
    <PlaceholderScreen
      icon="message.fill"
      title="Thread"
      caption={`Optimistic 1:1 messages for match "${matchId}" land here.`}
    />
  );
}