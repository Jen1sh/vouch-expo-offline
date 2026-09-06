import { useState } from "react";
import { Alert, Image, Pressable, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";

import Text from "@/components/Text";
import View from "@/components/View";
import { StyleSheet } from "@/src/theme";

type PhotoPickerProps = {
  value: string[];
  maxPhotos: number;
  onChange: (uris: string[]) => void;
};

/**
 * Picks photos from the device library and stores local URIs only (no upload).
 * Permission flow is graceful: a first denial re-asks; a permanent denial
 * (canAskAgain === false) shows an alert that deep-links to Settings.
 */
export default function PhotoPicker({ value, maxPhotos, onChange }: PhotoPickerProps) {
  const [isPicking, setIsPicking] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (value.length >= maxPhotos) {
      return;
    }
    setIsPicking(true);
    setPermissionError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.granted) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: maxPhotos - value.length,
          quality: 0.8,
        });
        if (!result.canceled) {
          const newUris = result.assets.map((asset) => asset.uri);
          onChange([...value, ...newUris].slice(0, maxPhotos));
        }
      } else if (permission.canAskAgain) {
        setPermissionError("Photo access is off. Allow it in your settings, then try again.");
      } else {
        showSettingsAlert();
      }
    } catch {
      setPermissionError("Could not open your photo library right now.");
    } finally {
      setIsPicking(false);
    }
  };

  const showSettingsAlert = () => {
    Alert.alert(
      "Photos access is off",
      "Vouch needs photo access so you can add photos to your profile. Open Settings to turn it on.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ]
    );
  };

  const removePhoto = (uri: string) => {
    onChange(value.filter((current) => current !== uri));
  };

  const canAdd = value.length < maxPhotos;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {value.map((uri) => (
          <Pressable
            key={uri}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            hitSlop={8}
            onPress={() => removePhoto(uri)}>
            <Image source={{ uri }} style={styles.photo} accessibilityIgnoresInvertColors />
          </Pressable>
        ))}
        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            accessibilityState={{ disabled: isPicking }}
            disabled={isPicking}
            onPress={handleAdd}
            style={styles.addSlot}>
            <Text variant="titleMd" color="secondary" accessibilityLiveRegion="polite">
              {isPicking ? "Adding…" : "Add"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text variant="bodySm" color="textMuted">
        {value.length} of {maxPhotos} · tap a photo to remove it
      </Text>
      {permissionError ? (
        <Text variant="labelMd" color="critical" accessibilityLiveRegion="polite">
          {permissionError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  addSlot: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: theme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceSubdued,
  },
}));