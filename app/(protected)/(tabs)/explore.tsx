import ParallaxScrollView from '@/components/parallax-scroll-view';
import Text from '@/components/Text';
import View from '@/components/View';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StyleSheet } from '@/src/theme';

export default function TabTwoScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>
      <View style={styles.titleContainer}>
        <Text variant="headlineLgMobile">Explore</Text>
      </View>
      <View style={styles.body}>
        <Text color="textSecondary">
          Coming soon — browse vouches, members, and your circle feed.
        </Text>
      </View>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  headerImage: {
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  body: {
    gap: 8,
  },
}));