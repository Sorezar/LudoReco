"use client";

import type { Game } from "@/lib/api";
import AnswerButtons from "./AnswerButtons";
import GameImage from "./GameImage";
import { useI18n } from "./I18nProvider";
import { ClockIcon, ExternalIcon, GaugeIcon, StarIcon, UsersIcon } from "./Icons";

function range(min: number | null, max: number | null) {
  if (min === null || max === null) return "?";
  return min === max ? `${min}` : `${min}–${max}`;
}

// A recommended game: box, key facts, main mechanics, and "already played?" to refine the next ones
export default function GameCard({ game, rank, onRate }: { game: Game; rank: number; onRate: (rating: number) => void }) {
  const { lang, t } = useI18n();
  const decimal = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); // 3.5 or 3,5
  const facts = [
    { icon: UsersIcon, label: t.game.players, value: range(game.min_players, game.max_players) },
    { icon: ClockIcon, label: t.game.minutes, value: range(game.min_playtime, game.max_playtime) },
    { icon: GaugeIcon, label: t.game.complexity, value: game.weight ? `${decimal.format(game.weight)}/5` : "?" },
    { icon: StarIcon, label: t.game.rating, value: game.rating ? decimal.format(game.rating) : "?" },
  ];

  return (
    <article
      className="animate-rise group flex flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
      style={{ animationDelay: `${((rank - 1) % 3) * 80}ms` }}
    >
      <div className="relative">
        <GameImage src={game.image ?? game.thumbnail} backdrop={game.thumbnail} name={game.name} sizes="(max-width: 768px) 100vw, 33vw" />
        <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 font-display text-sm font-semibold text-paper shadow">#{rank}</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="font-display text-xl font-semibold leading-tight">{game.name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {game.name !== game.original_name && <>{game.original_name} · </>}
            {game.year}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
              <Icon className="size-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <dt className="truncate text-[11px] uppercase tracking-wide text-muted">{label}</dt>
                <dd className="text-sm font-semibold">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
        {game.mechanics.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {game.mechanics.map((mechanic) => (
              <li key={mechanic} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                {mechanic}
              </li>
            ))}
          </ul>
        )}
        <a
          href={`https://boardgamegeek.com/boardgame/${game.id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent hover:text-accent-strong"
        >
          {t.game.view}
          <ExternalIcon className="size-3.5" />
        </a>
        <div className="-mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <span className="text-sm text-muted">{t.answers.played}</span>
          <AnswerButtons small onAnswer={onRate} />
        </div>
      </div>
    </article>
  );
}
