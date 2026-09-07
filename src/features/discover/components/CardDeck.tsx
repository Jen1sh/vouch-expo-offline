import { Image } from "expo-image";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { I18nManager, type LayoutChangeEvent } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
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
const SETTLE_SPRING: WithSpringConfig = { damping: 26, stiffness: 260, mass: 0.8, overshootClamping: false };

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
};

/**
 * The hand-written Discover deck: `Gesture.Pan` + Reanimated shared-value
 * springs only — no swipe library, no per-frame React state (all motion runs
 * on the UI thread through worklets).
 */
const CardDeck = forwardRef<CardDeckHandle, Props>(function CardDeck({ profilesById, slots, onSwiped }, ref) {

  const rtl = I18nManager.isRTL;

  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const dragging = useSharedValue(0);

  const top = slots[0] ? profilesById.get(slots[0].profileId) : undefined;

  // Dynamic values are read through refs so the worklets stay stable.
  const onSwipedRef = useRef(onSwiped);
  onSwipedRef.current = onSwiped;
  const topRef = useRef(top);
  topRef.current = top;
  const entryRef = useRef(slots[0]?.entry);
  entryRef.current = slots[0]?.entry;
  const swipeInProgress = useRef(false);

  const dispatchSwipe = useCallback((direction: SwipeDirection, profile: Profile) => {
    onSwipedRef.current(direction, profile);
  }, []);

  const dispatchSwipeRef = useRef(dispatchSwipe);
  dispatchSwipeRef.current = dispatchSwipe;

  const releaseSwipeLock = useCallback(() => {
    swipeInProgress.current = false;
  }, []);

  const releaseSwipeLockRef = useRef(releaseSwipeLock);
  releaseSwipeLockRef.current = releaseSwipeLock;

  /** One worklet for every dismissal — gestures and buttons share it. */
  const handleDismiss = useCallback(
    (direction: SwipeDirection, profile: Profile) => {
      'worklet';
      const target = exitVector(direction, Math.max(width.value, 1), Math.max(height.value, 1), rtl);
      const complete = (finished?: boolean) => {
        'worklet';
        if (finished) {
          runOnJS(dispatchSwipeRef.current)(direction, profile);
        }
        runOnJS(releaseSwipeLockRef.current)();
      };
      dragging.value = 0;
      tx.value = withSpring(target.x, DISMISS_SPRING, complete);
      ty.value = withSpring(target.y, DISMISS_SPRING);
      scale.value = withSpring(0.92, DISMISS_SPRING);
    },
    [width, height, dragging, rtl, tx, ty, scale]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onBegin(() => {
          dragging.value = 1;
        })
        .onUpdate((event) => {
          tx.value = event.translationX;
          ty.value = event.translationY;
        })
        .onEnd((event) => {
          dragging.value = 0;
          const direction = classifySwipe(
            {
              dx: event.translationX,
              dy: event.translationY,
              velocityX: event.velocityX,
              velocityY: event.velocityY,
            },
            rtl
          );
          const profile = topRef.current;
          if (direction && profile) {
            handleDismiss(direction, profile);
          } else {
            tx.value = withSpring(0, SNAP_SPRING);
            ty.value = withSpring(0, SNAP_SPRING);
            scale.value = withSpring(1, SNAP_SPRING);
          }
        })
        .onFinalize(() => {
          dragging.value = 0;
        }),
    [dragging, rtl, tx, ty, scale, handleDismiss]
  );

  useImperativeHandle(
    ref,
    () => ({
      swipe(direction) {
        const profile = topRef.current;
        if (!profile || swipeInProgress.current) {
          return;
        }
        swipeInProgress.current = true;
        handleDismiss(direction, profile);
      },
    }),
    [handleDismiss]
  );

  const rotation = useDerivedValue(() => {
    if (width.value <= 0) {
      return 0;
    }
    const deg = (tx.value / (width.value / 2)) * MAX_ROTATION_DEG;
    return Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, deg));
  });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateZ: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

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

  const frontProfileId = slots[0]?.profileId;

  // Reset + entry spring whenever the front card changes (advance, undo).
  useEffect(() => {
    const entry = entryRef.current;
    scale.value = entry?.scale ?? 1;
    tx.value = entry?.x ?? 0;
    ty.value = entry?.y ?? 0;
    dragging.value = 0;

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
  }, [frontProfileId, scale, tx, ty, dragging]);

  const onDeckLayout = useCallback(
    (event: LayoutChangeEvent) => {
      width.value = event.nativeEvent.layout.width;
      height.value = event.nativeEvent.layout.height;
    },
    [width, height]
  );

  const stack = useMemo(() => {
    const topSlot = slots[0] as DeckSlot | undefined;
    const underSlot = slots.slice(1, DECK_VISIBLE_SLOTS);
    return { topSlot, underSlot };
  }, [slots]);

  return (
    <Animated.View style={styles.deck} onLayout={onDeckLayout}>
      {[...stack.underSlot].reverse().map((slot, offset) => {
        const level = DECK_VISIBLE_SLOTS - 1 - offset;
        const profile = profilesById.get(slot.profileId);
        if (!profile) {
          return null;
        }
        return <StackedCard key={`stacked-${level}`} profile={profile} level={level} dragging={dragging} />;
      })}

      {stack.topSlot && top ? (
        <GestureDetector gesture={pan}>
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
  dragging,
}: {
  profile: Profile;
  level: number;
  dragging: SharedValue<number>;
}) {
  const progress = useSharedValue(level);

  useEffect(() => {
    progress.value = withSpring(level, SETTLE_SPRING);
  }, [level, progress]);

  useAnimatedReaction(
    () => dragging.value,
    (drag) => {
      progress.value = withSpring(level * (1 - drag), SETTLE_SPRING);
    },
    [dragging, progress, level]
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - progress.value * UNDERCARD_SCALE_STEP },
      { translateY: progress.value * UNDERCARD_TRANSLATE_STEP },
    ],
  }));

  return (
    <Animated.View style={[styles.stackedCard, style]} pointerEvents="none">
      <Image source={{ uri: profile.photos[0] }} style={styles.stackedPhoto} contentFit="cover" />
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
    borderRadius: theme.radius.xl,
    ...theme.shadows.level2,
  },
  stackedCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceSubdued,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: "hidden",
    ...theme.shadows.level1,
  },
  stackedPhoto: {
    flex: 1,
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