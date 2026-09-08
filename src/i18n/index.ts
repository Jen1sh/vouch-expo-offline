import { ar } from "@/src/i18n/ar";
import { en, type TranslationKey } from "@/src/i18n/en";
import { getSettings, useSettings } from "@/src/features/settings/store/settings";

/**
 * Minimal two-language i18n (REQUIREMENTS §3.8: English + Arabic, the Arabic
 * selection flips the whole app RTL). The chosen language lives in the
 * settings store (persisted to `app_settings`); dictionaries are flat and
 * type-checked to share keys, so adding a string means touching `en.ts`,
 * `ar.ts`, and nothing else.
 *
 * `t()` reads the current snapshot synchronously — safe inside event handlers
 * and render functions. `useI18n()` additionally subscribes so the text flips
 * live when the language preference changes.
 */

const DICTIONARIES: Record<"en" | "ar", Record<TranslationKey, string>> = { en, ar };

export type Language = "en" | "ar";

export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const language = getSettings().language;
  const table = DICTIONARIES[language] ?? en;
  let text: string = table[key] ?? en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}

export function useI18n() {
  const settings = useSettings();
  const language: Language = settings.language;
  return {
    language,
    isRTL: language === "ar",
    t: translate,
  };
}

export type { TranslationKey } from "@/src/i18n/en";