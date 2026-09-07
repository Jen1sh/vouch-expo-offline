import { useState } from "react";
import { Pressable, TextInput } from "react-native";

import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StyleSheet, useTheme } from "@/src/theme";

type MessageComposerProps = {
  onSend: (body: string) => void;
  /** Disable input + send (voucher guard, not-yet-ready thread). */
  disabled?: boolean;
};

/**
 * The message entry point (REQUIREMENTS §3.6). Composing is optimistically
 * delivered by the outbox (`sendMessage`); the composer only hands the text up
 * and clears immediately. The send affordance is native-adaptive and disabled
 * while empty so no empty messages are ever queued.
 */
export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const { colors } = useTheme();
  const [text, setText] = useState("");

  const canSend = !disabled && text.trim().length > 0;

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSend(text.trim());
    setText("");
  };

  return (
    <View style={styles.composer}>
      <TextInput
        accessibilityLabel="Message field"
        placeholder="Message…"
        placeholderTextColor={colors.textMuted}
        multiline
        value={text}
        onChangeText={setText}
        style={styles.input}
        editable={!disabled}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        hitSlop={6}
        onPress={submit}
        style={({ pressed }) => styles.sendButton(canSend, pressed)}>
        <IconSymbol
          name="paperplane.fill"
          size={20}
          color={canSend ? colors.onPrimary : colors.iconDefault}
        />
      </Pressable>
    </View>
  );
}

export default MessageComposer;

const styles = StyleSheet.create((theme) => ({
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSubdued,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.bodyMd.fontSize,
    lineHeight: theme.typography.bodyMd.lineHeight,
    fontFamily: theme.fontFamilies.sans[400],
  },
  sendButton: (enabled: boolean, pressed: boolean) => ({
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: enabled
      ? pressed
        ? theme.colors.primaryContainer
        : theme.colors.primary
      : theme.colors.surfaceSubdued,
  }),
}));