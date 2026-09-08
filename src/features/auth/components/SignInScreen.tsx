import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput } from "react-native";
import { router } from "expo-router";

import Button from "@/components/Button";
import Text from "@/components/Text";
import View from "@/components/View";
import { StyleSheet } from "@/src/theme";

/**
 * Step 1 of sign-in (REQUIREMENTS §3.1): phone number entry only. "Sign in"
 * pushes the 6-digit code screen; the phone travels as a route param so the
 * verify screen can show it, and back navigation returns here with the phone
 * state intact (this screen stays mounted under the (auth) Stack).
 */
export default function SignInScreen() {
  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = phone.trim();
  const canSubmit = normalized.length > 0;

  const handleSignIn = () => {
    if (/\D/.test(normalized)) {
      setError("Enter a valid phone number, digits only.");
      return;
    }
    setError(null);
    router.push({ pathname: "/verify", params: { phone: normalized } });
  };

  return (
    <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior="padding">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text variant="headlineMd">Welcome to Vouch</Text>
          <Text variant="bodyMd" color="textSecondary">
            Sign in with your phone number to continue.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input(focused)}
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Phone number"
            placeholderTextColor={styles.placeholder.color}
            keyboardType="phone-pad"
            autoComplete="tel"
            accessibilityLabel="Phone number"
          />

          {error ? (
            <Text variant="labelMd" color="critical" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          <Button onPress={handleSignIn} disabled={!canSubmit}>
            Sign in
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
}));