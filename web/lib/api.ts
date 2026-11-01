// Calls to the Python API (through the /api proxy of this app)
import type { Locale } from "./i18n";

export type Game = {
  id: number;
  name: string; // title of the local edition when BGG knows one
  original_name: string;
  year: number | null;
  min_players: number | null;
  max_players: number | null;
  min_playtime: number | null;
  max_playtime: number | null;
  weight: number | null;
  rating: number | null;
  mechanics: string[];
  image: string | null;
  thumbnail: string | null;
};

export type Preferences = {
  players: number | null;
  minutes: number | null;
  level: 1 | 2 | 3 | null;
  cooperative: boolean | null;
};

export type Ratings = Record<number, number>;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, init);
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

export function searchGames(query: string, lang: Locale): Promise<Game[]> {
  return call(`search?${new URLSearchParams({ q: query, limit: "6", lang })}`);
}

export function getGames(ids: number[], lang: Locale): Promise<Game[]> {
  const params = new URLSearchParams(ids.map((id) => ["ids", String(id)]));
  params.set("lang", lang);
  return call(`games?${params}`);
}

export function suggestGames(exclude: number[], lang: Locale, limit = 6): Promise<Game[]> {
  const params = new URLSearchParams(exclude.map((id) => ["exclude", String(id)]));
  params.set("limit", String(limit));
  params.set("lang", lang);
  return call(`suggestions?${params}`);
}

// Ratings of a BGG user's collection (total = all their rated games, games = those of our catalog)
export function importBggRatings(username: string, lang: Locale): Promise<{ total: number; games: { game: Game; rating: number }[] }> {
  return call(`bgg/${encodeURIComponent(username)}?lang=${lang}`);
}

export function recommendGames(
  ratings: Ratings,
  preferences: Preferences,
  lang: Locale,
  offset: number,
  limit = 3,
): Promise<{ total: number; games: Game[] }> {
  return call("recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ratings, ...preferences, lang, offset, limit }),
  });
}
