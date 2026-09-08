import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import Button from '@/components/Button';
import Text from '@/components/Text';
import View from '@/components/View';
import { showAppToast } from '@/src/components/AppToast';
import { StyleSheet } from '@/src/theme';
import { useAppMode, type AppMode } from '@/src/store/mode/AppModeProvider';
import { useAuth } from '@/src/features/auth/context/use-auth';
import { useI18n } from '@/src/i18n';
import type { TranslationKey } from '@/src/i18n/en';
import {
  setLanguage,
  setNotificationsEnabled,
  setThemeMode,
} from '@/src/features/settings/writes';
import {
  resetSettingsState,
  useSettings,
} from '@/src/features/settings/store/settings';
import type {
  LanguageSetting,
  ThemeModeSetting,
} from '@/src/db/queries/settings.queries';
import { clearUserShortlist } from '@/src/features/voucher/browse/store/user-shortlist';
import { clearUserSwipes } from '@/src/features/browse/store/user-swipes';
import { wipeLocalData } from '@/src/outbox';

type ModeOption = {
  value: AppMode;
  labelKey: 'settings.mode.member' | 'settings.mode.voucher';
  captionKey: 'settings.mode.memberCaption' | 'settings.mode.voucherCaption';
};

const MODE_OPTIONS: ModeOption[] = [
  { value: 'member', labelKey: 'settings.mode.member', captionKey: 'settings.mode.memberCaption' },
  { value: 'voucher', labelKey: 'settings.mode.voucher', captionKey: 'settings.mode.voucherCaption' },
];

const THEME_OPTIONS: { value: ThemeModeSetting; labelKey: 'settings.themeLight' | 'settings.themeDark' | 'settings.themeSystem' }[] = [
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'system', labelKey: 'settings.themeSystem' },
];

const LANGUAGE_OPTIONS: { value: LanguageSetting; labelKey: 'settings.languageEn' | 'settings.languageAr' }[] = [
  { value: 'en', labelKey: 'settings.languageEn' },
  { value: 'ar', labelKey: 'settings.languageAr' },
];

/**
 * Shared Settings screen for both navigation trees (REQUIREMENTS §3.8).
 * One account has two trees, switched here (§3.7); the toggles underneath
 * are the fully-wired preferences: theme (light/dark/system via unistyles),
 * language (English/Arabic with whole-app RTL), notifications (local
 * preference), plus sign out and a destructive local-data wipe. Every write
 * goes through `src/features/settings/writes.ts` → `app_settings`, then the
 * root layout's bridge applies the runtime side effects.
 */
export default function SettingsScreen() {
  const { mode, setMode } = useAppMode();
  const { signOut } = useAuth();
  const settings = useSettings();
  const { t } = useI18n();
  // useUnistyles(): raw track/thumb colors for the native Switch — a pure leaf.
  const { theme } = useUnistyles();
  const [wiping, setWiping] = useState(false);

  const applyTheme = (value: ThemeModeSetting) => {
    void setThemeMode(value).then(() => showAppToast('info', t('settings.themeUpdated')));
  };

  const applyLanguage = (value: LanguageSetting) => {
    void setLanguage(value).then(() => showAppToast('info', t('settings.languageUpdated')));
  };

  const applyNotifications = (enabled: boolean) => {
    void setNotificationsEnabled(enabled).then(() =>
      showAppToast('info', t('settings.notificationsUpdated'))
    );
  };

  const confirmWipe = () => {
    Alert.alert(t('settings.wipeConfirmTitle'), t('settings.wipeConfirmBody'), [
      { text: t('settings.wipeCancel'), style: 'cancel' },
      {
        text: t('settings.wipeConfirm'),
        style: 'destructive',
        onPress: () => {
          void wipe();
        },
      },
    ]);
  };

  const wipe = async () => {
    setWiping(true);
    try {
      await wipeLocalData();
      clearUserShortlist();
      clearUserSwipes();
      resetSettingsState();
      showAppToast('success', t('settings.dataWiped'));
    } finally {
      setWiping(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="headlineLgMobile" color="textPrimary">
          {t('settings.title')}
        </Text>
        {mode === 'voucher' ? (
          <View style={styles.modeBadge}>
            <Text variant="labelMd" color="onSecondaryContainer">
              {t('settings.modeActive')}
            </Text>
          </View>
        ) : null}
      </View>

      <Section title={t('settings.modeSection')}>
        <View variant="surfaceElevated" style={[styles.card, styles.modeCard]}>
          <Text variant="bodySm" color="textSecondary" style={styles.modeIntro}>
            {t('settings.modeIntro')}
          </Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {MODE_OPTIONS.map((option) => {
              const active = mode === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(option.labelKey)}
                  onPress={() => setMode(option.value)}
                  style={({ pressed }) => styles.option(active, pressed)}>
                  <Text
                    variant="labelLg"
                    color={active ? 'onSecondaryContainer' : 'textPrimary'}>
                    {t(option.labelKey)}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={active ? 'onSecondaryContainer' : 'textSecondary'}
                    style={styles.optionCaption}>
                    {t(option.captionKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Section>

      <Section title={t('settings.appearanceSection')}>
        <Text variant="labelLg" color="textPrimary">
          {t('settings.theme')}
        </Text>
        <Text variant="bodySm" color="textMuted" style={styles.caption}>
          {t('settings.themeCaption')}
        </Text>
        <ChoiceChips<ThemeModeSetting>
          options={THEME_OPTIONS}
          value={settings.themeMode}
          onSelect={applyTheme}
          t={t}
        />

        <Text variant="labelLg" color="textPrimary">
          {t('settings.language')}
        </Text>
        <Text variant="bodySm" color="textMuted" style={styles.caption}>
          {t('settings.languageCaption')}
        </Text>
        <ChoiceChips<LanguageSetting>
          options={LANGUAGE_OPTIONS}
          value={settings.language}
          onSelect={applyLanguage}
          t={t}
        />

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text variant="labelLg" color="textPrimary">
              {t('settings.notifications')}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {t('settings.notificationsCaption')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('settings.notifications')}
            value={settings.notificationsEnabled}
            onValueChange={applyNotifications}
            trackColor={{ true: theme.colors.secondary, false: theme.colors.borderSubtle }}
            thumbColor={theme.colors.surfaceElevated}
          />
        </View>
      </Section>

      <Section title={t('settings.dataSection')}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.wipe')}
          disabled={wiping}
          onPress={confirmWipe}
          style={({ pressed }) => styles.wipeRow(pressed)}>
          <View style={styles.toggleCopy}>
            <Text variant="labelLg" color="critical">
              {t('settings.wipe')}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {t('settings.wipeCaption')}
            </Text>
          </View>
          <Text variant="labelMd" color="critical">
            {wiping ? '…' : '›'}
          </Text>
        </Pressable>
      </Section>

      <View style={styles.signOut}>
        <Button variant="destructive" onPress={signOut}>
          {t('settings.signOut')}
        </Button>
      </View>
    </ScrollView>
  );
}

/** One elevated card per settings group, keeping the list scannable. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="labelCaps" color="textMuted">
        {title}
      </Text>
      <View variant="surfaceElevated" style={styles.card}>
        {children}
      </View>
    </View>
  );
}

type ChipOption<V extends string> = { value: V; labelKey: TranslationKey };

function ChoiceChips<V extends string>({
  options,
  value,
  onSelect,
  t,
}: {
  options: readonly ChipOption<V>[];
  value: V;
  onSelect: (value: V) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <View style={styles.chipGroup} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(option.labelKey)}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => styles.chip(selected, pressed)}>
            <Text variant="labelMd" color={selected ? 'onSecondaryContainer' : 'textSecondary'}>
              {t(option.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.gutterMobile,
    paddingBottom: theme.spacing['2xl'],
    gap: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  modeBadge: {
    borderWidth: 1,
    borderColor: theme.colors.voucherBorder,
    backgroundColor: theme.colors.voucherSurface,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing['2xs'],
  },
  section: {
    gap: theme.spacing.xs,
  },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.level1,
  },
  modeCard: {
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
  caption: {
    lineHeight: 18,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  chip: (selected: boolean, pressed: boolean) => ({
    backgroundColor: selected
      ? theme.colors.secondaryContainer
      : pressed
        ? theme.colors.hoverSurface
        : theme.colors.surfaceSubdued,
    borderWidth: 1.5,
    borderColor: selected ? theme.colors.secondary : theme.colors.borderSubtle,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing['2xs'],
    paddingHorizontal: theme.spacing.md,
  }),
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  toggleCopy: {
    flex: 1,
    gap: theme.spacing['2xs'],
  },
  wipeRow: (pressed: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: pressed ? theme.colors.hoverSurface : 'transparent',
  }),
  signOut: {
    marginTop: theme.spacing.xs,
  },
}));