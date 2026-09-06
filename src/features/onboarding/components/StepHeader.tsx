import Text from "@/components/Text";
import View from "@/components/View";
import { StyleSheet } from "@/src/theme";
import { ONBOARDING_STEP_COUNT, stepSubtitles, stepTitles } from "@/src/features/onboarding/schema";

type StepHeaderProps = {
  step: number;
};

export default function StepHeader({ step }: StepHeaderProps) {
  return (
    <View style={styles.header}>
      <Text variant="labelCaps" color="secondary" accessibilityRole="header">
        Step {step} of {ONBOARDING_STEP_COUNT}
      </Text>
      <Text variant="headlineLgMobile">{stepTitles[step]}</Text>
      <Text variant="bodyLg" color="textSecondary">
        {stepSubtitles[step]}
      </Text>
      <View style={styles.dots} accessible accessibilityHint="Onboarding progress">
        {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, index) => index + 1).map((dotStep) => (
          <View
            key={dotStep}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: ONBOARDING_STEP_COUNT, now: step }}
            style={styles.dot(dotStep <= step)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    gap: theme.spacing.xs,
  },
  dots: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  dot: (active: boolean) => ({
    width: 28,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: active ? theme.colors.secondary : theme.colors.borderSubtle,
  }),
}));