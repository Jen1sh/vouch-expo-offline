import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";

import Button from "@/components/Button";
import Text from "@/components/Text";
import View from "@/components/View";
import { useAuth } from "@/src/features/auth/context/use-auth";
import { useVerificationCode } from "@/src/hooks/use-verification-code";
import { verify } from "@/src/store/verification/verification-code-store";
import { StyleSheet } from "@/src/theme";

/**
 * Step 2 of sign-in (REQUIREMENTS §3.1): 6-digit code verification. The
 * expected code never leaves the app (it's shown in the Dev Panel); an inline
 * error handles a wrong code, resend shows the cooldown countdown, and
 * "Change number" returns to the phone screen without losing the phone (passed
 * here as a route param from `SignInScreen`).
 */
export default function VerifyCodeScreen() {
  const { signIn } = useAuth();
  const { cooldownRemaining, isCooldown, resend } = useVerificationCode();
  const { phone } = useLocalSearchParams<{ phone?: string }>();

  const [codeInput, setCodeInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = codeInput.length === 6 && !submitting;

  const handleSignIn = async () => {
    const result = verify(codeInput);
    if (!result.ok) {
      setError(
        result.reason === "format"
          ? "Enter the 6-digit code."
          : "Incorrect code. Please try again."
      );
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signIn();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handleResendCode = () => {
    setError(null);
    void resend();
    setResendNotice("Code re-sent");
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Text variant="headlineMd">Verify your code</Text>
          <Text variant="bodyMd" color="textSecondary">
            {phone
              ? `We sent a verification code to ${phone}.`
              : "Enter the 6-digit code from the Dev Panel."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change phone number"
            hitSlop={8}
            onPress={() => router.replace("/(auth)/sign-in")}
            style={({ pressed }) => styles.changePhone(pressed)}
          >
            <Text variant="labelMd" color="tertiary">
              Change number
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input(focused)}
            value={codeInput}
            onChangeText={(value) => {
              setCodeInput(value);
              setResendNotice(null);
              setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="6-digit code"
            placeholderTextColor={styles.placeholder.color}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            accessibilityLabel="Verification code"
          />

          {error ? (
            <Text variant="labelMd" color="critical" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <View style={styles.resendRow}>
            {isCooldown ? (
              <Text
                variant="labelMd"
                color="textMuted"
                accessibilityLiveRegion="polite"
              >
                Resend code in {formatCountdown(cooldownRemaining)}
              </Text>
            ) : (
              <Button variant="secondary" size="sm" onPress={handleResendCode}>
                Resend code
              </Button>
            )}
            {resendNotice ? (
              <Text
                variant="labelMd"
                color="tertiary"
                accessibilityLiveRegion="polite"
              >
                {resendNotice}
              </Text>
            ) : null}
          </View>

          <Button onPress={handleSignIn} disabled={!canSubmit}>
            Sign in
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create((theme) => ({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: theme.spacing.xl,
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingVertical: theme.spacing["2xl"],
  },
  header: {
    gap: theme.spacing.xs,
  },
  changePhone: (pressed: boolean) => ({
    alignSelf: "flex-start",
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing["2xs"],
    paddingHorizontal: theme.spacing.xs,
    marginHorizontal: -theme.spacing.xs,
    backgroundColor: pressed ? theme.colors.hoverSurface : "transparent",
  }),
  form: {
    gap: theme.spacing.md,
  },
  input: (isFocused: boolean) => ({
    ...theme.typography.bodyMd,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: isFocused ? theme.colors.secondary : theme.colors.borderSubtle,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  }),
  placeholder: {
    color: theme.colors.textMuted,
  },
  errorText: {
    marginTop: theme.spacing["2xs"],
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
  },
}));
