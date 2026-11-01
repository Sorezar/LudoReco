"use client";

import { useEffect, useState } from "react";
import { getGames, type Game, type Ratings } from "@/lib/api";
import { usePlayer, type Player, type Screen } from "@/lib/player";
import FiltersScreen from "./FiltersScreen";
import { useI18n } from "./I18nProvider";
import RateScreen from "./RateScreen";
import ResultsScreen from "./ResultsScreen";
import StartScreen from "./StartScreen";

function without(ratings: Ratings, id: number) {
  return Object.fromEntries(Object.entries(ratings).filter(([key]) => Number(key) !== id));
}

// The whole flow: welcome, filters, rating, recommendations. What the player did is kept in the browser.
export default function Recommender() {
  const { lang, t } = useI18n();
  const [player, update] = usePlayer();
  const [games, setGames] = useState<Record<number, Game>>({}); // rated games, in the language of the page
  const [notice, setNotice] = useState<string | null>(null); // shown once on the filters, after a BGG import

  function remember(list: Game[]) {
    setGames((current) => ({ ...current, ...Object.fromEntries(list.map((game) => [game.id, game])) }));
  }

  // Games rated during an earlier visit, or in another language: their titles and boxes are fetched again
  useEffect(() => {
    const missing = Object.keys(player.ratings).map(Number).filter((id) => !games[id]);
    if (missing.length) getGames(missing, lang).then(remember).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.ratings, lang]);

  function go(screen: Screen) {
    setNotice(null);
    update((current) => ({ ...current, screen }));
    window.scrollTo({ top: 0 });
  }

  function rate(game: Game, rating: number) {
    remember([game]);
    update((current) => ({ ...current, ratings: { ...without(current.ratings, game.id), [game.id]: rating } }));
  }

  function skip(game: Game) {
    update((current) => ({ ...current, skipped: [...current.skipped, game.id] }));
  }

  function remove(id: number) {
    update((current) => ({ ...current, ratings: without(current.ratings, id) }));
  }

  // The imported ratings, then the filters before the recommendations
  function importRatings(entries: { game: Game; rating: number }[], summary: string) {
    remember(entries.map(({ game }) => game));
    setNotice(summary);
    update((current) => ({
      ...current,
      screen: "filters",
      ratings: { ...current.ratings, ...Object.fromEntries(entries.map(({ game, rating }) => [game.id, rating])) },
    }));
    window.scrollTo({ top: 0 });
  }

  function reset() {
    update((): Player => ({ screen: "start", ratings: {}, skipped: [], preferences: player.preferences }));
  }

  if (player.screen === "rate") {
    return (
      <RateScreen
        ratings={player.ratings}
        skipped={player.skipped}
        games={games}
        onRate={rate}
        onSkip={skip}
        onRemove={remove}
        onHome={() => go("filters")}
        onResults={() => go("results")}
      />
    );
  }
  if (player.screen === "filters") {
    return (
      <FiltersScreen
        preferences={player.preferences}
        notice={notice}
        onChange={(preferences) => update((current) => ({ ...current, preferences }))}
        onBack={() => go("start")}
        // After a BGG import the player has ratings already: straight to the recommendations
        next={notice ? t.rate.see : t.filters.next}
        onNext={() => go(notice ? "results" : "rate")}
      />
    );
  }
  if (player.screen === "results") {
    return (
      <ResultsScreen
        ratings={player.ratings}
        preferences={player.preferences}
        onPreferences={(preferences) => update((current) => ({ ...current, preferences }))}
        onRate={rate}
        onBack={() => go("rate")}
      />
    );
  }
  return (
    <StartScreen
      count={Object.keys(player.ratings).length}
      onRate={() => go("filters")}
      onResults={() => go("results")}
      onImport={importRatings}
      onReset={reset}
    />
  );
}
