import { useState } from 'react';
import { ScrollView, TextInput, KeyboardAvoidingView } from 'react-native';

import Button from '@/components/Button';
import Text from '@/components/Text';
import View from '@/components/View';
import { useCountdown } from '@/src/hooks/use-countdown';
import { StyleSheet } from '@/src/theme';
import { useAuth } from '@/src/features/auth/context/use-auth';
import { generateVerificationCode } from '@/src/features/auth/generate-code';

const RESEND_COOLDOWN_SECONDS = 30;

type CodeInputFocus = 'phone' | 'code' | null;

export default function SignInScreen() {
  const { signIn } = useAuth();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState<CodeInputFocus>(null);
  const [expectedCode, setExpectedCode] = useState(generateVerificationCode);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const { remaining, isRunning, reset } = useCountdown(RESEND_COOLDOWN_SECONDS);

  const canSubmit = phone.trim().length > 0 && code.length === 6;

  const handleSignIn = async () => {
    if (code !== expectedCode) {
      setError('Incorrect code. Please try again.');
      return;
    }
    setError(null);
    try {
      await signIn();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const handleResendCode = () => {
    setError(null);
    setExpectedCode(generateVerificationCode());
    setResendNotice('Code re-sent');
    reset();
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
            style={styles.input(focused === 'phone')}
            value={phone}
            onChangeText={(value) => setPhone(value)}
            onFocus={() => setFocused('phone')}
            onBlur={() => setFocused(null)}
            placeholder="Phone number"
            placeholderTextColor={styles.placeholder.color}
            keyboardType="phone-pad"
            autoComplete="tel"
            accessibilityLabel="Phone number"
          />

          <TextInput
            style={styles.input(focused === 'code')}
            value={code}
            onChangeText={(value) => {
              setCode(value);
              setResendNotice(null);
            }}
            onFocus={() => setFocused('code')}
            onBlur={() => setFocused(null)}
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
            {isRunning ? (
              <Text variant="labelMd" color="textMuted" accessibilityLiveRegion="polite">
                Resend code in {formatCountdown(remaining)}
              </Text>
            ) : (
              <Button variant="secondary" size="sm" onPress={handleResendCode}>
                Resend code
              </Button>
            )}
            {resendNotice ? (
              <Text variant="labelMd" color="tertiary" accessibilityLiveRegion="polite">
                {resendNotice}
              </Text>
            ) : null}
          </View>

          <Button onPress={handleSignIn} disabled={!canSubmit}>
            Sign in
          </Button>

          {/* Stand-in for the Dev Panel's "current sign-in code" readout (REQUIREMENTS §3.1 / §4.5). */}
          <Text variant="labelMd" color="textMuted" style={styles.codeHint}>
            Demo code: {expectedCode}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create((theme) => ({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: theme.spacing.xl,
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingVertical: theme.spacing['2xl'],
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
    marginTop: theme.spacing['2xs'],
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  codeHint: {
    textAlign: 'center',
  },
}));