"use client";

import type { Preferences } from "@/lib/api";
import Filters from "./Filters";
import { useI18n } from "./I18nProvider";
import { ArrowLeftIcon, ArrowRightIcon } from "./Icons";

// First step: what kind of game the player is looking for (all optional, still editable on the results)
export default function FiltersScreen({
  preferences,
  notice,
  onChange,
  onBack,
  next,
  onNext,
}: {
  preferences: Preferences;
  notice: string | null; // e.g. the summary of a BGG import
  onChange: (preferences: Preferences) => void;
  onBack: () => void;
  next: string; // label of the button: rate games, or see the recommendations after a BGG import
  onNext: () => void;
}) {
  const { t } = useI18n();

  return (
    <section className="flex flex-col gap-5 pb-28">
      <div className="flex items-start gap-3">
        <button onClick={onBack} aria-label={t.rate.home} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card">
          <ArrowLeftIcon className="size-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{t.filters.title}</h1>
          <p className="text-sm text-muted">{t.filters.subtitle}</p>
        </div>
      </div>

      {notice && <p className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm font-semibold">✓ {notice}</p>}

      <Filters preferences={preferences} onChange={onChange} />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <button
          onClick={onNext}
          className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 font-semibold text-on-accent shadow-lg shadow-accent/25 transition active:scale-[0.98]"
        >
          {next}
          <ArrowRightIcon className="size-4" />
        </button>
      </div>
    </section>
  );
}
