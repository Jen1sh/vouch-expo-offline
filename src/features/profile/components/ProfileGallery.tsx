import { useCallback, useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";

import Text from "@/components/Text";
import View from "@/components/View";
import { StyleSheet, useTheme } from "@/src/theme";

type ProfileGalleryProps = {
  photos: string[];
  /** Used for the prefetch of the next image and screen-reader labels. */
  profileName: string;
};

/**
 * The profile photo gallery (REQUIREMENTS §3.5): a horizontal paging FlatList
 * with a dot indicator, prefetching the next photo so a page turn never shows
 * a blank tile (same rule as the Discover deck). Natural orientation is RTL
 * safe — a horizontal, `pagingEnabled` FlatList reverses automatically under
 * `I18nManager`, so the first photo stays index 0 on either reading order.
 */
export function ProfileGallery({ photos, profileName }: ProfileGalleryProps) {
  // useTheme(): raw dot track + glyph colors handed to dynamic style functions.
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  // Prefetch the photo after the current one (and the last few) so the next
  // page is already resident. FlatList renders one screen-width item at a time;
  // windowing prefetch happens on the mount and whenever the page advances.
  useEffect(() => {
    const upcoming = photos.slice(page + 1, page + 3);
    if (upcoming.length > 0) {
      void Image.prefetch(upcoming).catch(() => {
        // Offline or a flaky URL — the <Image> placeholder tile still renders.
      });
    }
  }, [page, photos]);

  const onPageEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setPage(Math.min(Math.max(0, next), Math.max(photos.length - 1, 0)));
  }, [width, photos.length]);

  if (photos.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Text variant="bodySm" color="textMuted">
          No photos yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <FlatList
        data={photos}
        keyExtractor={(uri) => uri}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPageEnd}
        testID="profile-gallery"
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={styles.photo(width)}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
            accessibilityLabel={`Photo ${photos.indexOf(item) + 1} of ${profileName}`}
          />
        )}
      />
      {photos.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((uri, index) => (
            <View
              key={uri}
              style={styles.dot(index === page, colors.onSurface, colors.imageScrimDotInactive)}
              testID={index === page ? `gallery-dot-active-${index}` : `gallery-dot-${index}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const GALLERY_HEIGHT_RATIO = 1.15;

const styles = StyleSheet.create((theme) => ({
  frame: {
    width: "100%",
  },
  photo: (width: number) => ({
    width,
    height: Math.min(460, Math.round(width * GALLERY_HEIGHT_RATIO)),
    backgroundColor: theme.colors.surfaceSubdued,
  }),
  placeholder: {
    width: "100%",
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceSubdued,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.xl,
  },
  dots: {
    position: "absolute",
    bottom: theme.spacing.md,
    alignSelf: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.imageScrim,
  },
  dot: (active: boolean, onSurface: string, inactive: string) => ({
    width: active ? 18 : 7,
    height: 7,
    borderRadius: theme.radius.full,
    backgroundColor: active ? onSurface : inactive,
  }),
}));