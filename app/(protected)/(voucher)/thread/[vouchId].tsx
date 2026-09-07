import { useLocalSearchParams } from 'expo-router';

import PlaceholderScreen from '@/components/placeholder-screen';

export default function VoucherThreadScreen() {
  const { vouchId } = useLocalSearchParams<{ vouchId: string }>();

  return (
    <PlaceholderScreen
      icon="message.fill"
      title="Thread"
      caption={`Three-way thread (you + both principals) for vouch "${vouchId}" lands here.`}
    />
  );
}