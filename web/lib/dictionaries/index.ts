import "server-only";
import type { Dictionary, Locale } from "../i18n";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";
import it from "./it";

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, de, es, it };

// Texts of the interface in this language (only the current one is sent to the browser)
export function getDictionary(locale: Locale) {
  return DICTIONARIES[locale];
}
