import { useLocalSearchParams } from 'expo-router';

import PlaceholderScreen from '@/components/placeholder-screen';

export default function ProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  return (
    <PlaceholderScreen
      icon="person.fill"
      title="Profile"
      caption={`${userId}'s gallery and details appear here.`}
    />
  );
}