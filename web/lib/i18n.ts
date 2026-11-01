// Languages of the interface (shared by the server and the browser: no dictionary here, see lib/dictionaries)
import type en from "./dictionaries/en";

export const LOCALES = { en: "English", fr: "Français", de: "Deutsch", es: "Español", it: "Italiano" } as const;
export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang"; // language chosen with the switcher, preferred over the browser's

export type Dictionary = typeof en;

export function hasLocale(value: string | undefined): value is Locale {
  return value !== undefined && Object.hasOwn(LOCALES, value);
}

// Fills the {placeholders} of a translated text
export function format(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
