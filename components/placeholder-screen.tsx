import { ScrollView } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import Text from '@/components/Text';
import View from '@/components/View';
import { StyleSheet, useTheme } from '@/src/theme';

type Props = {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  title: string;
  caption: string;
};

/**
 * Themed empty/placeholder state for not-yet-built screens. Keeps a route
 * honest while its feature lands (no fake data), and gives every stub the
 * same Warm Editorial voice instead of scattered divergent placeholders.
 */
export default function PlaceholderScreen({ icon, title, caption }: Props) {
  // useTheme() only to read raw `secondary` for the icon's non-style color
  // prop; this is a small pure leaf, per CONVENTIONS §6.2.
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View variant="surfaceElevated" style={styles.iconTile}>
        <IconSymbol name={icon} size={28} color={colors.secondary} />
      </View>
      <Text variant="headlineMd" color="textPrimary" style={styles.title}>
        {title}
      </Text>
      <View style={styles.rule} />
      <Text variant="bodyMd" color="textSecondary" style={styles.caption}>
        {caption}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingVertical: theme.spacing['3xl'],
    gap: theme.spacing.sm,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginBottom: theme.spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  rule: {
    width: 48,
    height: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.borderStrong,
    marginVertical: theme.spacing.xs,
  },
  caption: {
    textAlign: 'center',
    maxWidth: 320,
  },
}));