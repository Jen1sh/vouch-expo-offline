import { Pressable, TextInput } from "react-native";
import { Controller, type Control } from "react-hook-form";

import PhotoPicker from "./PhotoPicker";

import Text from "@/components/Text";
import View from "@/components/View";
import { StyleSheet } from "@/src/theme";
import type { FieldDef, OnboardingFormValues } from "@/src/features/onboarding/schema";

type FieldRendererProps = {
  field: FieldDef;
  control: Control<OnboardingFormValues>;
};

const SELECT_MULTI_TYPES: FieldDef["type"][] = ["select", "multiSelect"];

export default function FieldRenderer({ field, control }: FieldRendererProps) {
  return (
    <Controller
      control={control}
      name={field.key}
      render={({ field: controller, fieldState: { error } }) => {
        const arrayValue = Array.isArray(controller.value) ? controller.value : [];
        const stringValue = typeof controller.value === "string" ? controller.value : "";

        return (
          <View style={styles.field}>
            {field.type === "photos" ? (
              <PhotoPicker
                value={arrayValue}
                maxPhotos={field.maxPhotos ?? 6}
                onChange={(uris) => controller.onChange(uris)}
              />
            ) : SELECT_MULTI_TYPES.includes(field.type) && field.options ? (
              <View style={styles.chipGroup}>
                <Text variant="labelLg" color="textSecondary">
                  {field.label}
                </Text>
                <View style={styles.chips}>
                  {field.options.map((option) => {
                    const selected =
                      field.type === "multiSelect"
                        ? arrayValue.includes(option.value)
                        : stringValue === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole={field.type === "select" ? "radio" : "checkbox"}
                        accessibilityState={{ selected }}
                        accessibilityLabel={option.label}
                        onPress={() => {
                          if (field.type === "multiSelect") {
                            controller.onChange(
                              selected
                                ? arrayValue.filter((value) => value !== option.value)
                                : [...arrayValue, option.value]
                            );
                          } else {
                            controller.onChange(option.value);
                          }
                        }}
                        hitSlop={4}
                        style={styles.chip(selected)}>
                        <Text variant="labelMd" color={selected ? "onSecondaryContainer" : "textSecondary"}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text variant="labelLg" color="textSecondary">
                  {field.label}
                </Text>
                <TextInput
                  style={styles.input(error != null)}
                  value={stringValue}
                  onChangeText={controller.onChange}
                  onBlur={controller.onBlur}
                  placeholder={field.placeholder}
                  placeholderTextColor={styles.placeholder.color}
                  keyboardType={field.type === "phone" ? "phone-pad" : field.type === "date" ? "numbers-and-punctuation" : "default"}
                  maxLength={field.maxLength}
                  autoCapitalize={field.type === "text" ? "sentences" : "none"}
                  accessibilityLabel={field.label}
                />
              </View>
            )}

            {field.helperText ? (
              <Text variant="bodySm" color="textMuted">
                {field.helperText}
              </Text>
            ) : null}
            {error ? (
              <Text variant="labelMd" color="critical" accessibilityLiveRegion="polite">
                {error.message}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    gap: theme.spacing.xs,
  },
  inputGroup: {
    gap: theme.spacing.xs,
  },
  input: (hasError: boolean) => ({
    ...theme.typography.bodyMd,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: hasError ? theme.colors.critical : theme.colors.borderSubtle,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  }),
  placeholder: {
    color: theme.colors.textMuted,
  },
  chipGroup: {
    gap: theme.spacing.xs,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  chip: (selected: boolean) => ({
    backgroundColor: selected
      ? theme.colors.secondaryContainer
      : theme.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: selected ? theme.colors.secondary : theme.colors.borderSubtle,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  }),
}));