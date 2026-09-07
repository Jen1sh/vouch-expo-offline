import { ScrollView, Pressable } from 'react-native';

import Button from '@/components/Button';
import Text from '@/components/Text';
import View from '@/components/View';
import { StyleSheet } from '@/src/theme';
import { useAppMode, type AppMode } from '@/src/store/mode/AppModeProvider';
import { useAuth } from '@/src/features/auth/context/use-auth';

type ModeOption = {
  value: AppMode;
  label: string;
  caption: string;
};

const MODE_OPTIONS: ModeOption[] = [
  { value: 'member', label: 'Member', caption: 'Browse for yourself and chat' },
  { value: 'voucher', label: 'Voucher', caption: 'Browse and vouch on someone’s behalf' },
];

/**
 * Shared Settings screen for both navigation trees. The one piece of live
 * logic is the member/voucher ModeSwitcher (§3.7); theme/language/notification
 * toggles land with their own features. Sign out is here because the member
 * tree is the only place a signed-in user can reach a top-level screen.
 */
export default function SettingsScreen() {
  const { mode, setMode } = useAppMode();
  const { signOut } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineLgMobile" color="textPrimary">
        Settings
      </Text>

      <View style={styles.section}>
        <Text variant="labelCaps" color="textMuted">
          Mode
        </Text>
        <View variant="surfaceElevated" style={styles.modeCard}>
          <Text variant="bodySm" color="textSecondary" style={styles.modeIntro}>
            Your account has two navigation trees. Voucher mode swaps the whole
            app — you can never open a 1:1 chat, only read the three-way thread.
          </Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {MODE_OPTIONS.map((option) => {
              const active = mode === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.label}
                  onPress={() => setMode(option.value)}
                  style={({ pressed }) => styles.option(active, pressed)}>
                  <Text
                    variant="labelLg"
                    color={active ? 'onSecondaryContainer' : 'textPrimary'}>
                    {option.label}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={active ? 'onSecondaryContainer' : 'textSecondary'}
                    style={styles.optionCaption}>
                    {option.caption}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <Text variant="labelCaps" color="textMuted" style={styles.comingSoon}>
        Coming soon
      </Text>
      <View variant="surfaceElevated" style={styles.section}>
        <Text variant="bodyMd" color="textPrimary" style={styles.comingRow}>
          Theme · Language · Notifications
        </Text>
        <Text variant="bodySm" color="textMuted">
          These toggles arrive with their Settings features.
        </Text>
      </View>

      <View style={styles.signOut}>
        <Button variant="destructive" onPress={signOut}>
          Sign out
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.gutterMobile,
    paddingBottom: theme.spacing['2xl'],
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.xs,
  },
  modeCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  modeIntro: {
    lineHeight: 20,
  },
  options: {
    gap: theme.spacing.sm,
  },
  option: (active: boolean, pressed: boolean) => ({
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: active ? theme.colors.voucherAccent : theme.colors.borderSubtle,
    backgroundColor: active
      ? theme.colors.secondaryContainer
      : pressed
        ? theme.colors.hoverSurface
        : theme.colors.surfaceSubdued,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 2,
  }),
  optionCaption: {
    lineHeight: 18,
  },
  comingSoon: {
    marginTop: theme.spacing.sm,
  },
  comingRow: {
    lineHeight: 22,
  },
  signOut: {
    marginTop: theme.spacing.sm,
  },
}));
