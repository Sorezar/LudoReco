"use client";

import { useState } from "react";
import { importBggRatings, type Game } from "@/lib/api";
import { format } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";
import { DownloadIcon } from "./Icons";

// Imports the ratings of the player's BoardGameGeek collection
export default function BggImport({ onImport }: { onImport: (entries: { game: Game; rating: number }[], summary: string) => void }) {
  const { lang, t } = useI18n();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<{ loading?: boolean; message?: string; error?: boolean }>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    setStatus({ loading: true, message: t.bgg.fetching });
    try {
      const result = await importBggRatings(username.trim(), lang);
      const outside = result.total - result.games.length;
      const summary = format(t.bgg.imported, { count: result.games.length }) + (outside ? format(t.bgg.outside, { count: outside }) : "") + ".";
      if (result.games.length === 0) {
        setStatus({ message: result.total === 0 ? t.bgg.none : summary });
        return;
      }
      setStatus({});
      onImport(result.games, summary);
    } catch {
      setStatus({ error: true, message: t.bgg.error });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm sm:max-w-md">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold">
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
          <DownloadIcon className="size-4" />
        </span>
        {t.bgg.title}
      </h2>
      <div className="flex gap-2">
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder={t.bgg.placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          className="min-w-0 flex-1 rounded-xl border border-line bg-field px-4 py-2.5 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
        <button disabled={status.loading} className="rounded-xl bg-ink px-4 py-2.5 font-semibold text-paper transition hover:opacity-90 disabled:opacity-50">
          {status.loading ? t.bgg.importing : t.bgg.import}
        </button>
      </div>
      {status.message && <p className={`text-sm ${status.error ? "text-red-600 dark:text-red-400" : "text-muted"}`}>{status.message}</p>}
    </form>
  );
}
