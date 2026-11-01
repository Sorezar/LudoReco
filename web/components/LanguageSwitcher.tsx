"use client";

import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { GlobeIcon } from "./Icons";
import { useI18n } from "./I18nProvider";

// Language menu: the choice is remembered (cookie) and preferred over the browser's language
export default function LanguageSwitcher() {
  const { lang, t } = useI18n();

  function change(locale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    // Full load: a client navigation would keep the page of the previous language hidden in memory (and its <html lang>),
    // and nothing is lost since the player's answers are in the browser
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${locale}`);
  }

  return (
    // The code (FR) on phones, the name (Français) on larger screens; the invisible select opens the native picker
    <label className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card py-1.5 pl-2.5 pr-3 text-sm font-medium shadow-sm focus-within:border-accent">
      <GlobeIcon className="size-4 text-muted" />
      <span className="uppercase sm:hidden">{lang}</span>
      <span className="hidden sm:inline">{LOCALES[lang]}</span>
      <span aria-hidden className="text-xs text-muted">▾</span>
      <select
        value={lang}
        onChange={(event) => change(event.target.value as Locale)}
        aria-label={t.header.language}
        className="absolute inset-0 cursor-pointer bg-card text-ink opacity-0"
      >
        {Object.entries(LOCALES).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
