import { useEffect, useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import Button from '@/components/Button';
import Text from '@/components/Text';
import View from '@/components/View';
import { listOutboxItems, type OutboxItemRow } from '@/src/db/queries/outbox.queries';
import {
  resetDevPanelControls,
  setDevPanelControls,
  useDevPanelControls,
  type DevPanelControls,
} from '@/src/mocks/devPanelControls';
import { isDraining, wipeLocalData } from '@/src/outbox';
import { listMatches } from '@/src/db/queries/matches.queries';
import { createEventDedupe } from '@/src/realtime/dedupe';
import {
  forceDuplicateEvent,
  forceIncomingMessage,
  forceMatchEvent,
  getLastEmittedEvent,
  simulateTyping,
  subscribeToRealtime,
  type RealtimeEvent,
} from '@/src/realtime/realtimeChannel';
import { useVerificationCode } from '@/src/hooks/use-verification-code';
import { StyleSheet } from '@/src/theme';
// useUnistyles: pure-leaf escape hatch — raw theme colors for the native
// Switch's track/thumb props, which a StyleSheet can't express.

type FeedState = {
  received: number;
  applied: number;
  last: RealtimeEvent | null;
};

const LATENCY_CHOICES = [300, 600, 900, 1200];
const FAILURE_CHOICES = [0, 0.2, 0.5, 1];
const DUPLICATE_CHOICES = [0, 0.05, 0.25];
const OUT_OF_ORDER_STEP = 1;
const OUT_OF_ORDER_MIN = 0;
const OUT_OF_ORDER_MAX = 6;

export default function DevPanel() {
  const controls = useDevPanelControls();
  const { code, cooldownRemaining, isCooldown, resend } = useVerificationCode();
  const router = useRouter();
  const [feed, setFeed] = useState<FeedState>({ received: 0, applied: 0, last: getLastEmittedEvent() });
  const [outbox, setOutbox] = useState<OutboxItemRow[] | null>(null);
  const dedupeRef = useRef(createEventDedupe());

  const refreshOutbox = useCallback(async () => {
    setOutbox(await listOutboxItems());
  }, []);

  const confirmWipe = useCallback(() => {
    Alert.alert(
      'Wipe local data',
      'Clears the durable outbox and the swipe mirror. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe',
          style: 'destructive',
          onPress: () => {
            void wipeLocalData().then(() => refreshOutbox());
          },
        },
      ]
    );
  }, [refreshOutbox]);

  useEffect(() => {
    void refreshOutbox();
    return subscribeToRealtime((event) => {
      const applied = dedupeRef.current.accept(event);
      setFeed((previous) => ({
        received: previous.received + 1,
        applied: previous.applied + (applied ? 1 : 0),
        last: event,
      }));
    });
  }, [refreshOutbox]);

  const update = (patch: Partial<DevPanelControls>) => setDevPanelControls(patch);

  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

  /** Target the most-recent match so the Dev buttons always have a destination. */
  const newestMatchId = useCallback(async (): Promise<string | null> => {
    const matches = await listMatches();
    return matches[0]?.id ?? null;
  }, []);

  const sendTestIncoming = useCallback(async () => {
    const matchId = await newestMatchId();
    if (!matchId) {
      Alert.alert('No matches yet', 'Create a match before sending a test message.');
      return;
    }
    await forceIncomingMessage(matchId);
  }, [newestMatchId]);

  const sendTestTyping = useCallback(async () => {
    const matchId = await newestMatchId();
    if (!matchId) {
      Alert.alert('No matches yet', 'Create a match before simulating typing.');
      return;
    }
    await simulateTyping(matchId);
  }, [newestMatchId]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="headlineSm" accessibilityRole="header">
            Dev Panel
          </Text>
          <Text variant="bodySm" color="textMuted">
            Simulated network, realtime & account test knobs
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Dev Panel"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => styles.close(pressed)}>
          <Text variant="titleMd" color="textPrimary">
            Close
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Section title="Verification code">
          <View style={styles.codeRow}>
            <View style={styles.codeChip}>
              <Text variant="titleLg" color="textPrimary" style={styles.codeText}>
                {code ?? '------'}
              </Text>
            </View>
            <Button
              variant="secondary"
              size="sm"
              disabled={isCooldown}
              onPress={() => {
                void resend();
              }}>
              {isCooldown ? `Resend in ${cooldownRemaining}s` : 'Resend code'}
            </Button>
          </View>
          <Text variant="bodySm" color="textMuted">
            Resending regenerates the code globally — the sign-in screen picks it up on the next submit.
          </Text>
        </Section>

        <Section title="Simulated network">
          <ToggleRow
            label="Offline"
            caption="Rejects every request with a network error."
            value={controls.offline}
            onValueChange={(offline) => update({ offline })}
          />

          <ChoiceRow label="Latency" caption="Extra delay per request." helper={`Currently ${controls.latencyMinMs}–${controls.latencyMaxMs}ms`}>
            {LATENCY_CHOICES.map((value) => (
              <Chip
                key={value}
                label={`${value}ms`}
                selected={controls.latencyMaxMs === value && controls.latencyMinMs <= value}
                onPress={() => update({ latencyMinMs: value * 0.25, latencyMaxMs: value })}
              />
            ))}
          </ChoiceRow>

          <ChoiceRow label="Write failure rate" helper={`Currently ${formatPercent(controls.writeFailureRate)}`}>
            {FAILURE_CHOICES.map((value) => (
              <Chip
                key={value}
                label={formatPercent(value)}
                selected={controls.writeFailureRate === value}
                onPress={() => update({ writeFailureRate: value })}
              />
            ))}
          </ChoiceRow>

          <ChoiceRow label="Duplicate delivery rate" helper={`Currently ${formatPercent(controls.duplicateRate)}`}>
            {DUPLICATE_CHOICES.map((value) => (
              <Chip
                key={value}
                label={formatPercent(value)}
                selected={controls.duplicateRate === value}
                onPress={() => update({ duplicateRate: value })}
              />
            ))}
          </ChoiceRow>

          <StepperRow
            label="Out-of-order window"
            caption="How many events the channel may hold back before delivery."
            value={controls.outOfOrderWindow}
            onDecrement={() => update({ outOfOrderWindow: Math.max(OUT_OF_ORDER_MIN, controls.outOfOrderWindow - OUT_OF_ORDER_STEP) })}
            onIncrement={() => update({ outOfOrderWindow: Math.min(OUT_OF_ORDER_MAX, controls.outOfOrderWindow + OUT_OF_ORDER_STEP) })}
          />
        </Section>

        <Section title="Simulated realtime">
          <View style={styles.actionsRow}>
            <Button variant="secondary" size="sm" onPress={forceMatchEvent}>
              Force a match event
            </Button>
            <Button variant="secondary" size="sm" onPress={forceDuplicateEvent}>
              Force a duplicate
            </Button>
          </View>
          <EventFeed feed={feed} />
        </Section>

        <Section title="Chat">
          <ToggleRow
            label="Auto-reply"
            caption="Partners answer your messages after a short delay (disabled by default)."
            value={controls.autoReply}
            onValueChange={(autoReply) => update({ autoReply })}
          />
          <View style={styles.actionsRow}>
            <Button variant="secondary" size="sm" onPress={() => void sendTestIncoming()}>
              Force incoming message
            </Button>
            <Button variant="secondary" size="sm" onPress={() => void sendTestTyping()}>
              Simulate typing
            </Button>
          </View>
          <Text variant="bodySm" color="textMuted">
            Sent to your most recent match. Typing clears itself after a moment.
          </Text>
        </Section>

        <Section title="Outbox">
          <View style={styles.actionRow}>
            <View style={styles.actionCopy}>
              <Text variant="labelLg" color="textSecondary">
                Dump outbox contents
              </Text>
              <Text variant="bodySm" color="textMuted">
                {outbox === null
                  ? 'Loading…'
                  : outbox.length === 0
                    ? 'Empty — no queued actions.'
                    : `${outbox.length} item${outbox.length === 1 ? '' : 's'}${isDraining() ? ' — draining…' : ''}`}
              </Text>
            </View>
            <Button variant="secondary" size="sm" onPress={refreshOutbox}>
              Refresh
            </Button>
          </View>
          {outbox && outbox.length > 0 ? (
            <View style={styles.feed}>
              {outbox.slice(0, 10).map((item) => (
                <Text key={item.id} variant="bodySm" color="textMuted">
                  {item.type} · {item.status}
                  {item.attempts > 0 ? ` · ${item.attempts} attempt${item.attempts === 1 ? '' : 's'}` : ''}
                </Text>
              ))}
              {outbox.length > 10 ? (
                <Text variant="bodySm" color="textMuted">… {outbox.length - 10} more</Text>
              ) : null}
            </View>
          ) : null}
        </Section>

        <Section title="Danger zone">
          <View style={styles.actionRow}>
            <View style={styles.actionCopy}>
              <Text variant="labelLg" color="critical">
                Wipe local data
              </Text>
              <Text variant="bodySm" color="textMuted">
                Clears the drizzle-backed outbox and swipe mirror.
              </Text>
            </View>
            <Button variant="destructive" size="sm" onPress={confirmWipe}>
              Wipe now
            </Button>
          </View>
        </Section>

        <Button variant="secondary" size="sm" style={styles.resetButton} onPress={resetDevPanelControls}>
          Reset knobs to defaults
        </Button>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="labelCaps" color="textMuted">
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  caption,
  value,
  onValueChange,
}: {
  label: string;
  caption: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { theme } = useUnistyles(); // Raw track colors for the native Switch — a pure leaf, documented.
  return (
    <View style={styles.toggleRow}>
      <View style={styles.actionCopy}>
        <Text variant="labelLg" color="textPrimary">
          {label}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {caption}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.colors.secondary, false: theme.colors.borderSubtle }}
        thumbColor={theme.colors.surfaceElevated}
      />
    </View>
  );
}

function ChoiceRow({
  label,
  caption,
  helper,
  children,
}: {
  label: string;
  caption?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.choiceRow}>
      <View style={styles.actionCopy}>
        <Text variant="labelLg" color="textPrimary">
          {label}
        </Text>
        {caption ? (
          <Text variant="bodySm" color="textMuted">
            {caption}
          </Text>
        ) : null}
        {helper ? (
          <Text variant="bodySm" color="tertiary">
            {helper}
          </Text>
        ) : null}
      </View>
      <View style={styles.chipGroup}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => styles.chip(selected, pressed)}>
      <Text variant="labelMd" color={selected ? 'onSecondaryContainer' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepperRow({
  label,
  caption,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string;
  caption: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.choiceRow}>
      <View style={styles.actionCopy}>
        <Text variant="labelLg" color="textPrimary">
          {label}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {caption}
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          accessibilityState={{ disabled: value <= OUT_OF_ORDER_MIN }}
          disabled={value <= OUT_OF_ORDER_MIN}
          hitSlop={8}
          onPress={onDecrement}
          style={({ pressed }) => styles.stepperButton(pressed, value <= OUT_OF_ORDER_MIN)}>
          <Text variant="titleMd" color="textPrimary">
            −
          </Text>
        </Pressable>
        <Text variant="titleMd" color="secondary" style={styles.stepperValue} accessibilityLabel={`${label}: ${value}`}>
          {value}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          accessibilityState={{ disabled: value >= OUT_OF_ORDER_MAX }}
          disabled={value >= OUT_OF_ORDER_MAX}
          hitSlop={8}
          onPress={onIncrement}
          style={({ pressed }) => styles.stepperButton(pressed, value >= OUT_OF_ORDER_MAX)}>
          <Text variant="titleMd" color="textPrimary">
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function EventFeed({ feed }: { feed: FeedState }) {
  const kind = feed.last ? `${feed.last.type}` : 'No events yet';
  const dismissed = feed.received - feed.applied;
  return (
    <View style={styles.feed}>
      <Text variant="bodySm" color="textMuted">
        Last event: <Text variant="labelMd" color="textSecondary">{kind}</Text>
        {' · '}
        received {feed.received}, applied {feed.applied}
        {dismissed > 0 ? `, deduped ${dismissed}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingBottom: theme.spacing.sm,
  },
  headerText: {
    gap: theme.spacing['2xs'],
    flexShrink: 1,
  },
  close: (pressed: boolean) => ({
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing['2xs'],
    borderRadius: theme.radius.md,
    backgroundColor: pressed ? theme.colors.hoverSurface : 'transparent',
  }),
  content: {
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionBody: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  codeChip: {
    backgroundColor: theme.colors.surfaceSubdued,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minWidth: 160,
    alignItems: 'center',
  },
  codeText: {
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  actionCopy: {
    flex: 1,
    gap: theme.spacing['2xs'],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  choiceRow: {
    gap: theme.spacing.sm,
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  stepperButton: (pressed: boolean, disabled: boolean) => ({
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: pressed ? theme.colors.hoverSurface : theme.colors.surfaceSubdued,
    ...(disabled && { opacity: 0.4 }),
  }),
  stepperValue: {
    minWidth: 32,
    textAlign: 'center',
  },
  feed: {
    backgroundColor: theme.colors.surfaceSubdued,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  resetButton: {
    alignSelf: 'center',
    marginTop: theme.spacing.xs,
  },
}));