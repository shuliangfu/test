/**
 * @module @dreamer/test/i18n
 *
 * i18n for @dreamer/test: assertion errors, snapshot messages, benchmark output.
 * Uses $tr + module instance, no install(); locale auto-detected from env
 * (LANGUAGE/LC_ALL/LANG) when not set.
 */

import {
  createI18n,
  type I18n,
  type TranslationData,
  type TranslationParams,
} from "@dreamer/i18n";
import { getEnv } from "@dreamer/runtime-adapter";
import enUS from "./locales/en-US.json" with { type: "json" };
import zhCN from "./locales/zh-CN.json" with { type: "json" };

/** Supported locale. */
export type Locale = "en-US" | "zh-CN";

/** Default locale when detection fails. */
export const DEFAULT_LOCALE: Locale = "en-US";

const TEST_LOCALES: Locale[] = ["en-US", "zh-CN"];

const LOCALE_DATA: Record<string, TranslationData> = {
  "en-US": enUS as TranslationData,
  "zh-CN": zhCN as TranslationData,
};

/** Module-scoped i18n instance for test; not installed globally. */
let testI18n: I18n | null = null;

/**
 * Detect locale: LANGUAGE > LC_ALL > LANG.
 * Falls back to DEFAULT_LOCALE when unset or not in supported list.
 */
export function detectLocale(): Locale {
  const langEnv = getEnv("LANGUAGE") || getEnv("LC_ALL") || getEnv("LANG");
  if (!langEnv) return DEFAULT_LOCALE;
  const first = langEnv.split(/[:\s]/)[0]?.trim();
  if (!first) return DEFAULT_LOCALE;
  const match = first.match(/^([a-z]{2})[-_]([A-Z]{2})/i);
  if (match) {
    const normalized = `${match[1].toLowerCase()}-${
      match[2].toUpperCase()
    }` as Locale;
    if (TEST_LOCALES.includes(normalized)) return normalized;
  }
  const primary = first.substring(0, 2).toLowerCase();
  if (primary === "zh") return "zh-CN";
  if (primary === "en") return "en-US";
  return DEFAULT_LOCALE;
}

/**
 * Create test i18n instance and set locale. Call once at entry (e.g. test-runner or mod).
 * Does not call install(); uses module instance only.
 */
export function initTestI18n(): void {
  if (testI18n) return;
  const i18n = createI18n({
    defaultLocale: DEFAULT_LOCALE,
    fallbackBehavior: "default",
    locales: [...TEST_LOCALES],
    translations: LOCALE_DATA as Record<string, TranslationData>,
  });
  i18n.setLocale(detectLocale());
  testI18n = i18n;
}

/**
 * Translate by key. Uses module instance; when lang is not passed, uses current locale.
 * When init not called, returns key.
 */
export function $tr(
  key: string,
  params?: Record<string, string | number>,
  lang?: Locale,
): string {
  if (!testI18n) initTestI18n();
  if (!testI18n) return key;
  if (lang !== undefined) {
    const prev = testI18n.getLocale();
    testI18n.setLocale(lang);
    try {
      return testI18n.t(key, params as TranslationParams);
    } finally {
      testI18n.setLocale(prev);
    }
  }
  return testI18n.t(key, params as TranslationParams);
}
