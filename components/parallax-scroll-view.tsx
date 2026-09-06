import type { PropsWithChildren, ReactElement } from 'react';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';

import View from '@/components/View';
import { StyleSheet } from '@/src/theme';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
        },
      ],
    };
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.background}
      scrollEventThrottle={16}>
      <Animated.View style={[styles.header(headerBackgroundColor), headerAnimatedStyle]}>
        {headerImage}
      </Animated.View>
      <View style={styles.content}>{children}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  background: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: (headerBackgroundColor: { dark: string; light: string }) => ({
    height: HEADER_HEIGHT,
    overflow: 'hidden',
    backgroundColor:
      rt.colorScheme === 'dark' ? headerBackgroundColor.dark : headerBackgroundColor.light,
  }),
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
    overflow: 'hidden',
  },
}));