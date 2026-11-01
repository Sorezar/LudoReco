"use client";

import { useEffect, useRef, useState } from "react";
import { recommendGames, type Game, type Preferences, type Ratings } from "@/lib/api";
import { format } from "@/lib/i18n";
import Filters, { useActiveFilters } from "./Filters";
import GameCard from "./GameCard";
import { useI18n } from "./I18nProvider";
import { ArrowLeftIcon, SlidersIcon } from "./Icons";
import Sheet from "./Sheet";

const PAGE_SIZE = 3; // a few games at a time, so as not to drown the player in options

// Recommendations, PAGE_SIZE at a time, with filters; telling whether a recommended game was liked refines the others
export default function ResultsScreen({
  ratings,
  preferences,
  onPreferences,
  onRate,
  onBack,
}: {
  ratings: Ratings;
  preferences: Preferences;
  onPreferences: (preferences: Preferences) => void;
  onRate: (game: Game, rating: number) => void;
  onBack: () => void; // to rate more games
}) {
  const { lang, t } = useI18n();
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const latest = useRef(0);
  const [draft, setDraft] = useState<Preferences | null>(null); // filters being changed in the panel
  const active = useActiveFilters(preferences);

  function load(ratings: Ratings, preferences: Preferences, offset: number, limit: number) {
    const request = ++latest.current;
    recommendGames(ratings, preferences, lang, offset, limit)
      .then((page) => {
        if (request !== latest.current) return; // a newer request (another filter...) replaced this one
        setGames((shown) => [...shown.slice(0, offset), ...page.games]);
        setTotal(page.total);
        setError(false);
      })
      .catch(() => request === latest.current && setError(true))
      .finally(() => request === latest.current && setLoading(false));
  }

  // From the top again, keeping as many games shown
  function reload(ratings: Ratings, preferences: Preferences, limit: number) {
    setLoading(true);
    load(ratings, preferences, 0, limit);
  }

  useEffect(() => {
    load(ratings, preferences, 0, PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function filter(changed: Preferences) {
    onPreferences(changed);
    setGames([]);
    reload(ratings, changed, PAGE_SIZE);
  }

  function rate(game: Game, rating: number) {
    onRate(game, rating);
    reload({ ...ratings, [game.id]: rating }, preferences, Math.max(PAGE_SIZE, games.length));
  }

  const count = Object.keys(ratings).length;
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <button onClick={onBack} aria-label={t.results.rateMore} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card">
          <ArrowLeftIcon className="size-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{t.results.title}</h1>
          <p className="text-sm text-muted">
            {count === 0 ? t.results.noRating : count === 1 ? t.results.basedOnOne : format(t.results.basedOn, { count })}
          </p>
        </div>
      </div>

      {/* The filters chosen before, changed in a panel: the list is computed again once they are applied */}
      <button
        onClick={() => setDraft(preferences)}
        className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left shadow-sm transition hover:border-ink/40"
      >
        <SlidersIcon className="size-5 shrink-0 text-accent" />
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {active.length === 0 && <span className="text-sm text-muted">{t.filters.none}</span>}
          {active.map((filter) => (
            <span key={filter} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold">
              {filter}
            </span>
          ))}
        </span>
        <span className="shrink-0 text-sm font-semibold text-accent">{t.filters.edit}</span>
      </button>

      {draft && (
        <Sheet title={t.filters.title} onClose={() => setDraft(null)}>
          <div className="p-4">
            <Filters preferences={draft} onChange={setDraft} />
          </div>
          <div className="sticky bottom-0 border-t border-line bg-paper/90 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
            <button
              onClick={() => {
                filter(draft);
                setDraft(null);
              }}
              className="w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-on-accent shadow-lg shadow-accent/25 transition active:scale-[0.98]"
            >
              {t.filters.apply}
            </button>
          </div>
        </Sheet>
      )}

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{t.results.error}</p>}
      {total === 0 && !loading && <p className="rounded-2xl border border-line bg-card p-4">{t.results.empty}</p>}

      <div className={`grid gap-5 transition-opacity md:grid-cols-3 ${loading && games.length ? "opacity-50" : ""}`}>
        {games.map((game, i) => (
          <GameCard key={game.id} game={game} rank={i + 1} onRate={(rating) => rate(game, rating)} />
        ))}
        {loading && games.length === 0 && Array.from({ length: PAGE_SIZE }, (_, i) => <div key={i} className="h-[34rem] animate-pulse rounded-3xl bg-line/60" />)}
      </div>

      {total !== null && games.length > 0 && games.length < total && (
        <button
          onClick={() => {
            setLoading(true);
            load(ratings, preferences, games.length, PAGE_SIZE);
          }}
          disabled={loading}
          className="mx-auto w-full rounded-full border border-line bg-card px-6 py-3.5 font-semibold transition hover:border-ink/40 disabled:opacity-50 sm:w-auto"
        >
          {loading ? t.results.loading : format(t.results.more, { count: PAGE_SIZE })}
        </button>
      )}
      <button onClick={onBack} className="mx-auto inline-flex items-center gap-2 py-2 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon className="size-4" />
        {t.results.rateMore}
      </button>
    </section>
  );
}
