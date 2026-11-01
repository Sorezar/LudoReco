"use client";

import { useEffect, useRef, useState } from "react";
import { searchGames, suggestGames, type Game, type Ratings } from "@/lib/api";
import { format } from "@/lib/i18n";
import { ANSWERS, TARGET_RATINGS } from "@/lib/player";
import AnswerButtons from "./AnswerButtons";
import GameImage from "./GameImage";
import GameRow from "./GameRow";
import { useI18n } from "./I18nProvider";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, ListIcon, SearchIcon } from "./Icons";
import Sheet from "./Sheet";

const QUEUE = 6; // suggestions fetched ahead, so that the next one shows at once

type Props = {
  ratings: Ratings;
  skipped: number[];
  games: Record<number, Game>;
  onRate: (game: Game, rating: number) => void;
  onSkip: (game: Game) => void;
  onRemove: (id: number) => void;
  onHome: () => void;
  onResults: () => void;
};

// Rating: one well-known game at a time, plus a search and the list of the games already rated
export default function RateScreen({ ratings, skipped, games, onRate, onSkip, onRemove, onHome, onResults }: Props) {
  const { lang, t } = useI18n();
  const [queue, setQueue] = useState<Game[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [sheet, setSheet] = useState<"search" | "mine" | null>(null);
  const fetching = useRef(false);
  const count = Object.keys(ratings).length;

  // Keep a few suggestions ahead, never a game rated, skipped or already waiting
  useEffect(() => {
    if (queue.length >= QUEUE / 2 || fetching.current || exhausted) return;
    fetching.current = true;
    const exclude = [...Object.keys(ratings).map(Number), ...skipped, ...queue.map((game) => game.id)];
    suggestGames(exclude, lang, QUEUE)
      .then((more) => {
        setQueue((current) => [...current, ...more.filter((game) => !current.some((other) => other.id === game.id))]);
        if (more.length === 0) setExhausted(true);
      })
      .catch(() => setExhausted(true))
      .finally(() => (fetching.current = false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, exhausted]);

  const game = queue[0];
  function answer(rating: number | null) {
    if (rating === null) onSkip(game);
    else onRate(game, rating);
    setQueue((current) => current.slice(1));
  }

  return (
    <section className="flex flex-col gap-4 pb-28">
      <div className="flex items-center gap-2">
        <button onClick={onHome} aria-label={t.rate.home} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card">
          <ArrowLeftIcon className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1">
          <span className="text-sm font-semibold tabular-nums">{format(t.rate.progress, { count, target: TARGET_RATINGS })}</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gradient-to-r from-sun to-accent transition-all duration-500" style={{ width: `${Math.min(100, (count / TARGET_RATINGS) * 100)}%` }} />
          </div>
        </div>
        <button onClick={() => setSheet("search")} aria-label={t.rate.search} className="flex h-10 items-center gap-2 rounded-full border border-line bg-card px-3 text-sm font-semibold">
          <SearchIcon className="size-4" />
          <span className="hidden sm:inline">{t.rate.search}</span>
        </button>
        <button onClick={() => setSheet("mine")} aria-label={t.rate.mine} className="flex h-10 items-center gap-2 rounded-full border border-line bg-card px-3 text-sm font-semibold">
          <ListIcon className="size-4" />
          <span className="hidden sm:inline">{t.rate.mine}</span>
          <span className="tabular-nums text-muted">{count}</span>
        </button>
      </div>

      {/* The game, the answers and the bottom button fit in the screen, even a small phone: the box follows its height */}
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {game ? (
          <div key={game.id} className="animate-rise flex flex-col gap-3">
            <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-lg">
              <GameImage src={game.image ?? game.thumbnail} backdrop={game.thumbnail} name={game.name} sizes="(max-width: 448px) 100vw, 448px" className="h-[clamp(150px,34dvh,380px)]" />
              <div className="px-5 py-3 text-center">
                <h2 className="truncate font-display text-xl font-semibold leading-tight sm:text-2xl">{game.name}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {game.name !== game.original_name && <>{game.original_name} · </>}
                  {game.year}
                </p>
              </div>
            </div>
            <p className="hidden text-center text-sm font-semibold text-muted [@media(min-height:780px)]:block">{t.answers.question}</p>
            <AnswerButtons onAnswer={answer} />
            <button onClick={() => answer(null)} className="mx-auto inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-muted hover:text-ink">
              {t.answers.skip}
              <ArrowRightIcon className="size-4" />
            </button>
          </div>
        ) : exhausted ? (
          <p className="rounded-2xl border border-line bg-card p-5 text-center text-muted">{t.rate.noMore}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="h-[calc(clamp(150px,34dvh,380px)+60px)] animate-pulse rounded-3xl bg-line/60" />
            <div className="h-20 animate-pulse rounded-2xl bg-line/60" />
          </div>
        )}
        <p className="hidden text-center text-xs text-muted [@media(min-height:780px)]:block">{format(t.rate.hint, { target: TARGET_RATINGS })}</p>
      </div>

      {/* Always at hand, under the thumb */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <button
          onClick={onResults}
          className={`mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold transition active:scale-[0.98] ${
            count >= TARGET_RATINGS ? "bg-accent text-on-accent shadow-lg shadow-accent/25" : "bg-ink text-paper"
          }`}
        >
          {t.rate.see}
          <ArrowRightIcon className="size-4" />
        </button>
      </div>

      {sheet === "search" && <SearchSheet ratings={ratings} onRate={onRate} onClose={() => setSheet(null)} />}
      {sheet === "mine" && <MyGamesSheet ratings={ratings} games={games} onRate={onRate} onRemove={onRemove} onClose={() => setSheet(null)} />}
    </section>
  );
}

function SearchSheet({ ratings, onRate, onClose }: { ratings: Ratings; onRate: (game: Game, rating: number) => void; onClose: () => void }) {
  const { lang, t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[] | null>(null);

  // Search as the player types, once they paused for a moment
  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => searchGames(query.trim(), lang).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(timer);
  }, [query, lang]);

  return (
    <Sheet title={t.rate.searchTitle} onClose={onClose}>
      <div className="sticky top-0 bg-paper px-5 pb-2 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-field px-3 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
          <SearchIcon className="size-4 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.rate.searchPlaceholder}
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
          />
        </div>
      </div>
      {query.trim().length >= 2 && results && (
        <ul className="divide-y divide-line pb-4">
          {results.length === 0 && <li className="px-5 py-4 text-sm text-muted">{t.rate.noResult}</li>}
          {results.map((game) => (
            <GameRow key={game.id} game={game}>
              <AnswerButtons small value={ratings[game.id]} onAnswer={(rating) => onRate(game, rating)} />
            </GameRow>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function MyGamesSheet({
  ratings,
  games,
  onRate,
  onRemove,
  onClose,
}: {
  ratings: Ratings;
  games: Record<number, Game>;
  onRate: (game: Game, rating: number) => void;
  onRemove: (id: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const answers: number[] = Object.values(ANSWERS);
  // Latest first
  const ids = Object.keys(ratings).map(Number).reverse();

  return (
    <Sheet title={`${t.rate.mine} · ${ids.length}`} onClose={onClose}>
      {ids.length === 0 && <p className="px-5 py-6 text-sm text-muted">{t.rate.empty}</p>}
      <ul className="divide-y divide-line pb-4">
        {ids.map((id) => (
          <GameRow key={id} game={games[id]}>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                {games[id] && <AnswerButtons small value={ratings[id]} onAnswer={(rating) => onRate(games[id], rating)} />}
                <button onClick={() => onRemove(id)} aria-label={t.rate.remove} className="grid size-8 place-items-center rounded-full text-muted hover:bg-line/60 hover:text-ink">
                  <CloseIcon className="size-4" />
                </button>
              </div>
              {!answers.includes(ratings[id]) && <span className="text-[11px] text-muted">{format(t.rate.rated, { rating: ratings[id] })}</span>}
            </div>
          </GameRow>
        ))}
      </ul>
    </Sheet>
  );
}
