import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import Button from "@/components/Button";
import Text from "@/components/Text";
import View from "@/components/View";
import FieldRenderer from "./FieldRenderer";
import StepHeader from "./StepHeader";
import { getVisibleFields } from "@/src/features/onboarding/schema";
import { useOnboardingForm } from "@/src/features/onboarding/use-onboarding-form";
import { StyleSheet } from "@/src/theme";

export default function OnboardingScreen() {
  const { form, step, loadedProfileStep, goBack, goNext, canGoBack, isLastStep } = useOnboardingForm();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const watchValues = form.watch();
  const visibleFields = getVisibleFields(step, watchValues);

  const handleNext = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setSaveError(false);
    try {
      await goNext();
    } catch {
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  };

  if (loadedProfileStep === null) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMd" color="textMuted">
          Loading your profile…
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic">
        <StepHeader step={step} />
        {saveError ? (
          <Text variant="labelMd" color="critical" accessibilityLiveRegion="polite">
            Could not save your progress. Please try again.
          </Text>
        ) : null}
        {visibleFields.map((field) => (
          <FieldRenderer key={field.key} field={field} control={form.control} />
        ))}
        <View style={styles.actions}>
          {canGoBack ? (
            <Button variant="secondary" size="lg" style={styles.backButton} onPress={goBack}>
              Back
            </Button>
          ) : null}
          <Button variant="primary" size="lg" style={styles.continueButton} onPress={handleNext} disabled={busy}>
            {isLastStep ? "Finish" : "Continue"}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  backButton: {
    flex: 0,
    minWidth: 112,
  },
  continueButton: {
    flex: 1,
  },
}));