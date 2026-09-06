import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import Text from '@/components/Text';
import View from '@/components/View';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <View style={styles.titleContainer}>
        <Text variant="headlineLgMobile">Welcome to Vouch</Text>
      </View>
      <View style={styles.body}>
        <Text color="textSecondary">Your circles, vouched for and shared — even offline.</Text>
      </View>
      <Link href="/modal">
        <Text color="secondary" style={styles.link}>
          Open the modal
        </Text>
      </Link>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  body: {
    gap: 8,
    marginBottom: 8,
  },
  link: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 30,
    marginTop: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});