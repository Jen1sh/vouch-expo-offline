import { useLocalSearchParams } from 'expo-router';

import VoucherCandidateScreen from '@/src/features/voucher/profile/components/VoucherCandidateScreen';

export default function VoucherCandidateRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  // Thin route container (SKILLS "Add a new screen/route"): it only extracts
  // the id and delegates rendering to the candidate presentational feature.
  return <VoucherCandidateScreen profileId={userId} />;
}