import { useLocalSearchParams } from 'expo-router';

import { ProfileScreen } from '@/src/features/profile';

export default function ProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  // Thin route container (SKILLS "Add a new screen/route"): it only extracts
  // the id and delegates rendering to the ProfileScreen presentational feature.
  return <ProfileScreen profileId={userId} />;
}