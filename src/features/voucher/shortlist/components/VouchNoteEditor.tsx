import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAppToast } from "@/src/components/AppToast";
import { useI18n } from "@/src/i18n";
import { enqueueUpdateVouchNote } from "@/src/outbox";
import { StyleSheet, useTheme } from "@/src/theme";

export const VOUCH_NOTE_MAX_LENGTH = 200;
export const VOUCH_NOTE_DEBOUNCE_MS = 800;
export const VOUCH_NOTE_DEPTH_MIN = 140;

type VouchNoteEditorProps = {
  profileId: string;
  /** The durable note for this candidate (source of truth). */
  note: string;
  profileName: string;
};

/**
 * The vouch-note editor (REQUIREMENTS §3.9): an inline textarea under each
 * shortlisted row. Typing updates the local draft instantly (fully offline
 * safe), then a debounced, durability-first write flushes the latest text
 * through `enqueueUpdateVouchNote` — the mirror and the outbox share one
 * transaction, so the note survives a crash mid-typing cycle. Past the depth
 * threshold the hint flips to a quiet confirmation.
 */
export function VouchNoteEditor({ profileId, note, profileName }: VouchNoteEditorProps) {
  const { t } = useI18n();
  // useTheme(): raw glyph color for the depth-reached seal (non-style prop).
  const { colors } = useTheme();
  const [draft, setDraft] = useState(note);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the draft in sync when the durable note changes externally (e.g. the
  // row is reloaded after a remove/re-add); typing owns it between writes.
  useEffect(() => {
    setDraft(note);
  }, [note]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = null;
    };
  }, []);

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void enqueueUpdateVouchNote(profileId, value.trim()).then(() =>
        showAppToast("success", t("shortlist.noteSaved"))
      );
    }, VOUCH_NOTE_DEBOUNCE_MS);
  };

  const depth = draft.trim().length >= VOUCH_NOTE_DEPTH_MIN;

  return (
    <View style={styles.editor}>
      <View style={styles.editorHeader}>
        <Text variant="labelMd" color="textSecondary">
          {t("shortlist.noteLabel")}
        </Text>
        <Text variant="labelCaps" color={depth ? "verifiedText" : "textMuted"}>
          {t("shortlist.charCount", { count: String(draft.length), max: String(VOUCH_NOTE_MAX_LENGTH) })}
        </Text>
      </View>

      <TextInput
        testID={`vouch-note-input-${profileId}`}
        accessibilityLabel={t("shortlist.noteA11y", { name: profileName })}
        style={styles.input}
        value={draft}
        onChangeText={onDraftChange}
        placeholder={t("shortlist.notePlaceholder")}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={VOUCH_NOTE_MAX_LENGTH}
        textAlignVertical="top"
      />

      <View style={styles.hintRow}>
        {depth ? (
          <>
            <IconSymbol name="checkmark.seal.fill" size={14} color={colors.verifiedText} />
            <Text variant="bodySm" color="verifiedText">
              {t("shortlist.noteDepthReached")}
            </Text>
          </>
        ) : (
          <Text variant="bodySm" color="textMuted">
            {t("shortlist.noteHint")}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  editor: {
    gap: theme.spacing.xs,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    minHeight: 88,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surfaceSubdued,
    padding: theme.spacing.sm,
    ...theme.typography.bodyMd,
    color: theme.colors.textPrimary,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["2xs"],
  },
}));