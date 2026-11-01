"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";

const I18nContext = createContext<{ lang: Locale; t: Dictionary } | null>(null);

// Gives the client components the language of the page and its texts
export default function I18nProvider({ lang, dictionary, children }: { lang: Locale; dictionary: Dictionary; children: React.ReactNode }) {
  return <I18nContext value={{ lang, t: dictionary }}>{children}</I18nContext>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
