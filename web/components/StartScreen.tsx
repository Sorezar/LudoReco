"use client";

import { format } from "@/lib/i18n";
import BggImport from "./BggImport";
import { useI18n } from "./I18nProvider";
import { ArrowRightIcon, RestartIcon } from "./Icons";
import type { Game } from "@/lib/api";

// Welcome: what the site does, then start (or continue) rating games, or import them from BGG
export default function StartScreen({
  count,
  onRate,
  onResults,
  onImport,
  onReset,
}: {
  count: number; // games the player already rated (kept in the browser)
  onRate: () => void;
  onResults: () => void;
  onImport: (entries: { game: Game; rating: number }[], summary: string) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="animate-rise flex flex-col gap-8 pt-4 sm:pt-10">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">{t.start.title}</h1>
        <p className="text-lg text-muted text-pretty">{t.start.subtitle}</p>
      </div>

      <div className="flex flex-col gap-3 sm:max-w-md">
        <button
          onClick={onRate}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-lg font-semibold text-on-accent shadow-lg shadow-accent/25 transition hover:bg-accent-strong active:scale-[0.98]"
        >
          {count ? format(t.start.resume, { count }) : t.start.begin}
          <ArrowRightIcon className="size-5" />
        </button>
        {count > 0 && (
          <>
            <button onClick={onResults} className="rounded-full border border-line bg-card px-6 py-3.5 font-semibold transition hover:border-ink/40">
              {t.start.see}
            </button>
            <button onClick={onReset} className="inline-flex items-center justify-center gap-2 py-2 text-sm text-muted hover:text-ink">
              <RestartIcon className="size-4" />
              {t.start.reset}
            </button>
          </>
        )}
      </div>

      <BggImport onImport={onImport} />

      <ol className="grid gap-3 sm:grid-cols-3">
        {t.start.steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-sm text-muted">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-card font-display font-semibold text-ink">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
