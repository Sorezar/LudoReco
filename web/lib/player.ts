// What the player did (screen, answers, filters), kept in the browser so that a reload or a change of language loses nothing
import { useMemo, useSyncExternalStore } from "react";
import type { Preferences, Ratings } from "./api";

export type Screen = "start" | "rate" | "filters" | "results";
export type Player = { screen: Screen; ratings: Ratings; skipped: number[]; preferences: Preferences };

// Answers of the interface, turned into 1-10 ratings for the model: the mean BGG rating of each range (up to 5, 6-7, 8 and more).
// Measured on new players, these 3 answers recommend as well as exact ratings; a "loved" answer for 9-10 only does worse,
// because it pushes the 7s into "liked" (BGG imports keep their exact ratings).
export const ANSWERS = { dislike: 4.3, ok: 6.75, love: 8.6 } as const;
export type Answer = keyof typeof ANSWERS;
export function answerOf(rating: number): Answer {
  return rating < 5.5 ? "dislike" : rating < 7.75 ? "ok" : "love";
}

export const TARGET_RATINGS = 10; // recommendations get much better up to about 10 answers
export const NO_PREFERENCES: Preferences = { players: null, minutes: null, level: null, cooperative: null };
const EMPTY: Player = { screen: "start", ratings: {}, skipped: [], preferences: NO_PREFERENCES };

const KEY = "boardgame-recommender:player";
const listeners = new Set<() => void>();
let saved: string | null | undefined; // undefined until read; kept in memory when the storage is blocked

function snapshot() {
  if (saved === undefined) {
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      saved = null;
    }
  }
  return saved;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function save(player: Player) {
  saved = JSON.stringify(player);
  try {
    localStorage.setItem(KEY, saved);
  } catch {}
  listeners.forEach((listener) => listener());
}

function parse(text: string | null): Player {
  try {
    return text ? { ...EMPTY, ...JSON.parse(text) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

// The player's state and a function to change it (the server and the first render see an empty player)
export function usePlayer(): [Player, (change: (player: Player) => Player) => void] {
  const text = useSyncExternalStore(subscribe, snapshot, () => null);
  const player = useMemo(() => parse(text), [text]);
  return [player, (change) => save(change(parse(snapshot())))];
}
