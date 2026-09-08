import { forwardRef, useCallback, useEffect, useLayoutEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { I18nManager, type LayoutChangeEvent } from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
  type WithSpringConfig,
} from "react-native-reanimated";

import Text from "@/components/Text";
import {
  classifySwipe,
  DECK_VISIBLE_SLOTS,
  exitVector,
  HORIZONTAL_SWIPE_THRESHOLD,
  MAX_ROTATION_DEG,
  UNDERCARD_SCALE_STEP,
  UNDERCARD_TRANSLATE_STEP,
  VERTICAL_SWIPE_THRESHOLD,
  type SwipeDirection,
} from "@/src/features/discover/model/deck";
import SwipeCard from "@/src/features/discover/components/SwipeCard";
import { StyleSheet } from "@/src/theme";
import type { Profile } from "@/src/types/profile";

/**
 * Motion configs mirror the theme spring tokens (`spring.dismiss`,
 * `spring.snapBack`) as local constants — Reanimated worklets can't read the
 * theme object, so the canonical values are repeated here and kept in sync.
 */
const DISMISS_SPRING: WithSpringConfig = { damping: 18, stiffness: 340, mass: 0.8, overshootClamping: true };
const SNAP_SPRING: WithSpringConfig = { damping: 22, stiffness: 240, mass: 0.7, overshootClamping: false };
/** How fast an under-card re-seats into its stack slot after advancing. */
const SETTLE_SPRING: WithSpringConfig = { damping: 24, stiffness: 280, mass: 0.8, overshootClamping: false };

export type DeckSlot = {
  profileId: string;
  depth: number;
  /** Optional mount transform so a re-entering card springs in from where it left. */
  entry?: { x?: number; y?: number; scale?: number };
};

export type CardDeckHandle = {
  /** Programmatic dismissal — what the Like/Skip/Ask-voucher buttons call. */
  swipe: (direction: SwipeDirection) => void;
};

type Props = {
  profilesById: ReadonlyMap<string, Profile>;
  slots: readonly DeckSlot[];
  onSwiped: (direction: SwipeDirection, profile: Profile) => void;
  /** Called when the front card is tapped without dragging (opens the profile). */
  onPressCard?: (profile: Profile) => void;
};

/**
 * The hand-written Discover deck: `Gesture.Pan` + Reanimated shared-value
 * springs only — no swipe library, no per-frame React state (all motion runs
 * on the UI thread through worklets).
 *
 * Only the front card owns a `GestureDetector` (it remounts with the card), so
 * there is never more than one gesture attachment and no gesture object is
 * ever handed between detectors — each front change (advance, undo) attaches a
 * fresh pan/tap to the new top card, which keeps swipes reliable on restored
 * cards. Under-cards are plain views keyed by `profileId` (correct content,
 * no level-keyed swaps) with their own seat springs.
 */
const CardDeck = forwardRef<CardDeckHandle, Props>(function CardDeck({ profilesById, slots, onSwiped, onPressCard }, ref) {

  const rtl = I18nManager.isRTL;

  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  const top = slots[0] ? profilesById.get(slots[0].profileId) : undefined;

  // The front profile is read INSIDE gesture/dismiss worklets, so it must live
  // in a shared value — a mutable ref captured by a worklet would both warn
  // ("Tried to modify key `current` …") and freeze the stale snapshot. The
  // value is refreshed in an effect (never during render — Reanimated's strict
  // mode flags render-phase writes) so the worklets always see the current
  // front card. Gestures only ever begin after the commit + effect settle.
  const topSV = useSharedValue<Profile | null>(top ?? null);

  useEffect(() => {
    topSV.value = top ?? null;
  }, [top, topSV]);

  // JS-thread-only refs (never captured by a worklet) for the latest callback
  // and the one-shot undo entry.
  const onSwipedRef = useRef(onSwiped);
  onSwipedRef.current = onSwiped;
  const onPressCardRef = useRef(onPressCard);
  onPressCardRef.current = onPressCard;
  const entryRef = useRef(slots[0]?.entry);
  entryRef.current = slots[0]?.entry;

  // One-shot swipe lock (a shared value: JS writes it, the tap worklet reads
  // it). Every dismissal holds it for its whole flight — both the imperative
  // button path AND the pan path — so an overlapping dismissal (a button tap
  // or a re-grab while a card is already flying out) can never double-advance
  // the deck. Cleared when the dismissal's spring settles.
  const swipeInProgress = useSharedValue(false);

  // Per-dismissal latch: guards against the completion callback firing twice
  // for one spring (which would double-dispatch and skip a person). Reset at
  // the start of every dismissal; writes happen on the UI thread only.
  const dispatchFired = useSharedValue(false);

  // Stable callbacks scheduled back onto the RN thread via `scheduleOnRN` — no
  // ref hop, no deprecated `runOnJS` re-export.
  const dispatchSwipe = useCallback((direction: SwipeDirection, profile: Profile) => {
    onSwipedRef.current(direction, profile);
  }, []);

  const releaseSwipeLock = useCallback(() => {
    swipeInProgress.value = false;
  }, [swipeInProgress]);

  // Reads the latest press callback on the JS thread (the worklet only carries
  // the stable function reference — the ref itself is never captured).
  const pressProfile = useCallback((profile: Profile) => {
    onPressCardRef.current?.(profile);
  }, []);

  /** One worklet for every dismissal — gestures and buttons share it. */
  const handleDismiss = useCallback(
    (direction: SwipeDirection, profile: Profile) => {
      'worklet';
      swipeInProgress.value = true;
      dispatchFired.value = false;
      const target = exitVector(direction, Math.max(width.value, 1), Math.max(height.value, 1), rtl);
      const complete = (finished?: boolean) => {
        'worklet';
        if (finished && !dispatchFired.value) {
          dispatchFired.value = true;
          scheduleOnRN(dispatchSwipe, direction, profile);
        }
        scheduleOnRN(releaseSwipeLock);
      };
      tx.value = withSpring(target.x, DISMISS_SPRING, complete);
      ty.value = withSpring(target.y, DISMISS_SPRING);
      scale.value = withSpring(0.92, DISMISS_SPRING);
    },
    [width, height, rtl, tx, ty, scale, dispatchSwipe, releaseSwipeLock, swipeInProgress, dispatchFired]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onUpdate((event) => {
          tx.value = event.translationX;
          ty.value = event.translationY;
        })
        .onEnd((event) => {
          if (swipeInProgress.value) {
            return;
          }
          const direction = classifySwipe(
            {
              dx: event.translationX,
              dy: event.translationY,
              velocityX: event.velocityX,
              velocityY: event.velocityY,
            },
            rtl
          );
          const profile = topSV.value;
          if (direction && profile) {
            handleDismiss(direction, profile);
          } else {
            tx.value = withSpring(0, SNAP_SPRING);
            ty.value = withSpring(0, SNAP_SPRING);
            scale.value = withSpring(1, SNAP_SPRING);
          }
        }),
    [rtl, tx, ty, scale, handleDismiss, topSV, swipeInProgress]
  );

  const pressCard = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        if (swipeInProgress.value) {
          return;
        }
        const profile = topSV.value;
        if (profile) {
          runOnJS(pressProfile)(profile);
        }
      }),
    [topSV, swipeInProgress, pressProfile]
  );

  const frontGesture = useMemo(() => Gesture.Exclusive(pressCard, pan), [pan, pressCard]);

  useImperativeHandle(
    ref,
    () => ({
      swipe(direction) {
        const profile = topSV.value;
        if (!profile || swipeInProgress.value) {
          return;
        }
        handleDismiss(direction, profile);
      },
    }),
    [handleDismiss, topSV, swipeInProgress]
  );

  const rotation = useDerivedValue(() => {
    if (width.value <= 0) {
      return 0;
    }
    const deg = (tx.value / (width.value / 2)) * MAX_ROTATION_DEG;
    return Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, deg));
  });

  const likeProgress = useDerivedValue(() => {
    const dir = rtl ? -1 : 1;
    if (Math.abs(tx.value) < Math.abs(ty.value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, (tx.value * dir) / (HORIZONTAL_SWIPE_THRESHOLD * 1.4)));
  });

  const skipProgress = useDerivedValue(() => {
    const dir = rtl ? -1 : 1;
    if (Math.abs(tx.value) < Math.abs(ty.value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, (-tx.value * dir) / (HORIZONTAL_SWIPE_THRESHOLD * 1.4)));
  });

  const askProgress = useDerivedValue(() => {
    if (Math.abs(ty.value) <= Math.abs(tx.value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, -ty.value / (VERTICAL_SWIPE_THRESHOLD * 1.4)));
  });

  // 0..1 how far the stack has been dragged toward a dismissal, derived on the
  // UI thread so the under-cards track the finger continuously. Decays with the
  // snap-back spring and climbs with the dismissal spring.
  const travel = useDerivedValue(() => {
    const distance = Math.abs(tx.value) + Math.abs(ty.value);
    return Math.min(1, distance / (HORIZONTAL_SWIPE_THRESHOLD * 1.4));
  });

  const frontProfileId = slots[0]?.profileId;

  // Reset + entry spring whenever the front card changes (advance, undo).
  // useLayoutEffect (pre-paint) so the newly mounted front card's first frame
  // already carries its resting transform — no visible kick from the previous
  // card's leftover shared values.
  useLayoutEffect(() => {
    const entry = entryRef.current;
    scale.value = entry?.scale ?? 1;
    tx.value = entry?.x ?? 0;
    ty.value = entry?.y ?? 0;

    if (entry) {
      if (entry.scale !== undefined && entry.scale !== 1) {
        scale.value = withSpring(1, SNAP_SPRING);
      }
      if (entry.x !== undefined && entry.x !== 0) {
        tx.value = withSpring(0, SNAP_SPRING);
      }
      if (entry.y !== undefined && entry.y !== 0) {
        ty.value = withSpring(0, SNAP_SPRING);
      }
    }
  }, [frontProfileId, scale, tx, ty]);

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateZ: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const onDeckLayout = useCallback(
    (event: LayoutChangeEvent) => {
      width.value = event.nativeEvent.layout.width;
      height.value = event.nativeEvent.layout.height;
    },
    [width, height]
  );

  const visible = slots.slice(0, DECK_VISIBLE_SLOTS);
  const [frontSlot, ...underSlots] = visible;

  return (
    <Animated.View style={styles.deck} onLayout={onDeckLayout}>
      {/* Under-cards: deepest first so the front renders last (on top). Keyed by
          profileId — no level-keyed content switching. */}
      {[...underSlots].reverse().map((slot, offset) => {
        const profile = profilesById.get(slot.profileId);
        if (!profile) {
          return null;
        }
        const level = underSlots.length - offset;
        return <StackedCard key={slot.profileId} profile={profile} level={level} travel={travel} />;
      })}

      {frontSlot && top ? (
        <GestureDetector gesture={frontGesture}>
          <Animated.View key={top.id} style={[styles.topCard, topStyle]}>
            <DragBadge kind="like" progress={likeProgress} />
            <DragBadge kind="skip" progress={skipProgress} />
            <DragBadge kind="ask" progress={askProgress} />
            <SwipeCard profile={top} />
          </Animated.View>
        </GestureDetector>
      ) : null}
    </Animated.View>
  );
});

function StackedCard({
  profile,
  level,
  travel,
}: {
  profile: Profile;
  level: number;
  travel: SharedValue<number>;
}) {
  // Each under-card owns its seat depth, so after an advance the trail re-seats
  // 2 → 1 → 2 smoothly instead of teleporting. The `travel` follower makes all
  // under-cards rise as the stack is dragged/dismissed.
  const progress = useSharedValue(level);

  useEffect(() => {
    progress.value = withSpring(level, SETTLE_SPRING);
  }, [level, progress]);

  const style = useAnimatedStyle(() => {
    const seat = progress.value * (1 - travel.value);
    return {
      transform: [
        { scale: 1 - seat * UNDERCARD_SCALE_STEP },
        { translateY: seat * UNDERCARD_TRANSLATE_STEP },
      ],
    };
  });

  return (
    <Animated.View style={[styles.stackedCard, style]} pointerEvents="none">
      <SwipeCard profile={profile} />
    </Animated.View>
  );
}

function DragBadge({
  kind,
  progress,
}: {
  kind: "like" | "skip" | "ask";
  progress: SharedValue<number>;
}) {
  const opacity = useAnimatedStyle(() => ({ opacity: progress.value }));
  const copy = kind === "like" ? "Like" : kind === "skip" ? "Skip" : "Ask your voucher";
  const position = kind === "like" ? "left" : kind === "skip" ? "right" : "bottom";

  return (
    <Animated.View style={[styles.badge(kind, position), opacity]}>
      <Text variant="labelCaps" color={kind === "skip" ? "critical" : "onSecondaryContainer"}>
        {copy}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  deck: {
    flex: 1,
  },
  topCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radius["2xl"],
    // Same resting shadow as the under-cards — the heavier level2 glow blurs
    // 24px around the focused card and reads as a stray "border" at rest.
    ...theme.shadows.level1,
  },
  stackedCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radius["2xl"],
    backgroundColor: theme.colors.surfaceSubdued,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: "hidden",
    ...theme.shadows.level1,
  },
  badge: (kind: "like" | "skip" | "ask", position: "left" | "right" | "bottom") => ({
    position: "absolute",
    zIndex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: kind === "skip" ? theme.colors.critical : theme.colors.secondary,
    backgroundColor: kind === "skip" ? theme.colors.criticalContainer : theme.colors.secondaryContainer,
    ...(position === "left" && { top: theme.spacing.lg, left: theme.spacing.lg }),
    ...(position === "right" && { top: theme.spacing.lg, right: theme.spacing.lg }),
    ...(position === "bottom" && { left: "25%", right: "25%", bottom: theme.spacing.lg, alignItems: "center" }),
  }),
}));

export { CardDeck };