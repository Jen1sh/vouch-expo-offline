import { Platform, Pressable } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '@/components/Text';
import { StyleSheet } from '@/src/theme';

const FAB_SIZE = 56;

/**
 * Floating Dev Panel entry point (replaces the shake gesture per requirements
 * §4.5). Renders above every screen — sign-in, onboarding, tabs — so the
 * panel is reachable from anywhere. Hidden while already on the panel itself.
 */
export default function DevPanelFab() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (pathname === '/dev-panel') {
    return null;
  }

  const top = Math.max(insets.top + 24, Platform.OS === 'ios' ? 24 : 32);
  const right = Math.max(insets.right + 16, 16);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Dev Panel"
      onPress={() => router.push('/dev-panel')}
      style={({ pressed }) => styles.fab(top, right, pressed)}>
      <Text variant="labelMd" color="devPanelText" style={styles.label}>
        DEV
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  fab: (top: number, right: number, pressed: boolean) => ({
    position: 'absolute',
    top,
    right,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: pressed ? theme.colors.borderStrong : theme.colors.devPanelPill,
    borderWidth: 1,
    borderColor: theme.colors.devPanelBorder,
    ...theme.shadows.level2,
  }),
  label: {
    letterSpacing: 1,
  },
}));