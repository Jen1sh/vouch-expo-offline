import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, type LayoutChangeEvent } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import Text from "@/components/Text";
import View from "@/components/View";
import DeckEmptyState from "@/src/features/discover/components/DeckEmptyState";
import { CardDeck, type CardDeckHandle, type DeckSlot } from "@/src/features/discover/components/CardDeck";
import { useDiscoverDeck } from "@/src/features/discover/hooks/useDiscoverDeck";
import {
  DECK_VISIBLE_SLOTS,
  exitVector,
  type SwipeDirection,
} from "@/src/features/discover/model/deck";
import { DeckFpsOverlay, logSwipeCost, recordDiscoverRender } from "@/src/features/discover/performance";
import { useDevPanelControls } from "@/src/mocks/devPanelControls";
import { SEED_PROFILES } from "@/src/mocks/seed/profiles";
import { StyleSheet, useTheme } from "@/src/theme";
import type { Profile } from "@/src/types/profile";

const PROMOTE_SCALE = 1 - DECK_VISIBLE_SLOTS * 0.05;

export default function DiscoverScreen() {
  const { deck, profilesById, handleSwiped, handleUndo, handleReset } = useDiscoverDeck();
  const controls = useDevPanelControls();
  const deckRef = useRef<CardDeckHandle>(null);

  const [deckSize, setDeckSize] = useState({ width: 0, height: 0 });
  const deckSizeRef = useRef(deckSize);
  deckSizeRef.current = deckSize;

  const [pendingUndoEntry, setPendingUndoEntry] = useState<{ x: number; y: number } | null>(null);
  const lastDirectionRef = useRef<SwipeDirection | null>(null);

  const onSwiped = useCallback(
    (direction: SwipeDirection, profile: Profile) => {
      logSwipeCost();
      lastDirectionRef.current = direction;
      handleSwiped(direction, profile);
    },
    [handleSwiped]
  );

  // Cost accounting: runs once per React render and only bumps on discrete
  // state commits — the gesture itself never re-renders the tree.
  useEffect(() => {
    recordDiscoverRender();
  });

  const onUndo = useCallback(() => {
    const direction = lastDirectionRef.current;
    if (!direction) {
      return;
    }
    const { x, y } = exitVector(direction, deckSizeRef.current.width, deckSizeRef.current.height);
    setPendingUndoEntry({ x, y });
    handleUndo();
  }, [handleUndo]);

  // One-shot: the restored card only springs in once, not on every re-render.
  useEffect(() => {
    if (pendingUndoEntry) {
      setPendingUndoEntry(null);
    }
  }, [pendingUndoEntry]);

  const hasAdvanced = SEED_PROFILES.length - deck.remaining.length > 0;

  const slots = useMemo<DeckSlot[]>(() => {
    const out: DeckSlot[] = deck.remaining
      .slice(0, DECK_VISIBLE_SLOTS)
      .map((profileId, depth) => ({ profileId, depth }));
    const front = out[0];
    if (front) {
      if (pendingUndoEntry) {
        front.entry = pendingUndoEntry;
      } else if (hasAdvanced) {
        // Promotion from the stack: pop from under-card scale up to full.
        front.entry = { scale: PROMOTE_SCALE };
      }
    }
    return out;
  }, [deck.remaining, pendingUndoEntry, hasAdvanced]);

  const onDeckLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDeckSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height }
    );
  }, []);

  const pressSwipe = useCallback((direction: SwipeDirection) => {
    deckRef.current?.swipe(direction);
  }, []);

  const deckDone = deck.remaining.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text variant="headlineSm" color="textPrimary">
          Discover
        </Text>
        {controls.offline ? (
          <View style={styles.offlinePill}>
            <Text variant="labelMd" color="offlineText">
              Offline — swipes queued
            </Text>
          </View>
        ) : null}
      </View>

      {deckDone ? (
        <DeckEmptyState onBrowseAgain={handleReset} onUndo={deck.lastSwipe ? onUndo : undefined} />
      ) : (
        <>
          <View style={styles.deckArea} onLayout={onDeckLayout}>
            <DeckFpsOverlay />
            <CardDeck
              ref={deckRef}
              profilesById={profilesById}
              slots={slots}
              onSwiped={onSwiped}
            />
          </View>

          <View style={styles.actions} accessibilityRole="toolbar">
            <ActionButton
              label="Undo last swipe"
              icon="arrow.uturn.backward"
              tone="ghost"
              disabled={!deck.lastSwipe}
              onPress={onUndo}
            />
            <ActionButton label="Skip" icon="xmark" tone="critical" onPress={() => pressSwipe("skip")} />
            <ActionButton label="Ask your voucher to look" icon="arrow.up" tone="accent" onPress={() => pressSwipe("askVoucher")} />
            <ActionButton label="Like" icon="heart.fill" tone="primary" onPress={() => pressSwipe("like")} />
          </View>
        </>
      )}
    </View>
  );
}

type ActionTone = "ghost" | "critical" | "accent" | "primary";

function ActionButton({
  label,
  icon,
  tone,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: Parameters<typeof IconSymbol>[0]["name"];
  tone: ActionTone;
  disabled?: boolean;
  onPress: () => void;
}) {
  // useTheme(): raw icon color for the glyph inside the themed circle.
  const { colors } = useTheme();
  const iconColor =
    tone === "primary"
      ? colors.onPrimary
      : tone === "ghost"
        ? colors.textSecondary
        : tone === "critical"
          ? colors.critical
          : colors.secondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => styles.action(tone, pressed, disabled)}>
      <IconSymbol name={icon} size={tone === "ghost" ? 20 : 26} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingBottom: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.spacing.sm,
  },
  offlinePill: {
    backgroundColor: theme.colors.offlineBackground,
    borderWidth: 1,
    borderColor: theme.colors.offlineBorder,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing['2xs'],
  },
  deckArea: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  action: (tone: ActionTone, pressed: boolean, disabled: boolean) => {
    const sizing = tone === "ghost" ? 44 : 60;
    const palette = {
      ghost: {
        background: theme.colors.surfaceElevated,
        border: theme.colors.borderSubtle,
        pressed: theme.colors.hoverSurface,
      },
      critical: {
        background: theme.colors.criticalContainer,
        border: theme.colors.critical,
        pressed: theme.colors.criticalContainer,
      },
      accent: {
        background: theme.colors.secondaryContainer,
        border: theme.colors.secondary,
        pressed: theme.colors.secondaryContainer,
      },
      primary: {
        background: theme.colors.primary,
        border: theme.colors.primary,
        pressed: theme.colors.primary,
      },
    }[tone];

    return {
      width: sizing,
      height: sizing,
      borderRadius: theme.radius.full,
      borderWidth: 1.5,
      backgroundColor: pressed ? palette.pressed : palette.background,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
      ...(disabled && { opacity: 0.4 }),
      ...(tone === "primary" && theme.shadows.level1),
    };
  },
}));