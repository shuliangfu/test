/**
 * @module @dreamer/test/i18n
 *
 * i18n for @dreamer/test: assertion errors, snapshot messages, benchmark output.
 * When lang is not passed, locale is auto-detected from env
 * (LANGUAGE/LC_ALL/LANG).
 */

import {
  $i18n,
  getGlobalI18n,
  getI18n,
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

let testTranslationsLoaded = false;

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
 * Load test translations into the current I18n instance (once).
 */
export function ensureTestI18n(): void {
  if (testTranslationsLoaded) return;
  const i18n = getGlobalI18n() ?? getI18n();
  i18n.loadTranslations("en-US", enUS as TranslationData);
  i18n.loadTranslations("zh-CN", zhCN as TranslationData);
  testTranslationsLoaded = true;
}

/**
 * Load translations and set current locale. Call once at entry (e.g. test-runner).
 */
export function initTestI18n(): void {
  ensureTestI18n();
  const effective = detectLocale();
  $i18n.setLocale(effective);
}

/**
 * Translate by key. When lang is not passed, uses current locale (set at entry).
 * Call ensureTestI18n() and setLocale at entry (e.g. test-runner or mod), not here.
 */
export function $t(
  key: string,
  params?: TranslationParams,
  lang?: Locale,
): string {
  if (lang !== undefined) {
    const prev = $i18n.getLocale();
    $i18n.setLocale(lang);
    try {
      return $i18n.t(key, params);
    } finally {
      $i18n.setLocale(prev);
    }
  }
  return $i18n.t(key, params);
}
