"use client";

import type { Preferences } from "@/lib/api";
import { format } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";
import { ClockIcon, GaugeIcon, TargetIcon, UsersIcon } from "./Icons";

export type Value = Preferences[keyof Preferences];
export type Filter = { key: keyof Preferences; label: string; options: [Value, string][] };

const ICONS = { players: UsersIcon, minutes: ClockIcon, level: GaugeIcon, cooperative: TargetIcon };

// The filters and their choices, in the language of the page
export function useFilters(): Filter[] {
  const { t } = useI18n();
  const f = t.filters;
  return [
    {
      key: "players",
      label: f.players,
      // Exact counts, then large groups (party games): "12+" = games that can be played at 12
      options: [...Array.from({ length: 10 }, (_, i) => [i + 1, `${i + 1}`] as [Value, string]), [12, "12+"], [15, "15+"], [20, "20+"]],
    },
    {
      key: "minutes",
      label: f.minutes,
      options: ([[30, "30 min"], [60, "1 h"], [90, "1 h 30"], [120, "2 h"], [180, "3 h"]] as [number, string][]).map(
        ([minutes, label]) => [minutes, format(f.upTo, { value: label })],
      ),
    },
    { key: "level", label: f.level, options: f.levels.map((label, i) => [i + 1, label]) },
    { key: "cooperative", label: f.style, options: [[true, f.cooperative], [false, f.competitive]] },
  ];
}

// The active filters, as "Players · 4" (empty when there is none)
export function useActiveFilters(preferences: Preferences) {
  return useFilters().flatMap(({ key, label, options }) => {
    const chosen = options.find(([value]) => value === preferences[key]);
    return chosen ? [`${label} · ${chosen[1]}`] : [];
  });
}

// One group of buttons per filter, "Any" first: on the filters step and in the panel of the results
export default function Filters({ preferences, onChange }: { preferences: Preferences; onChange: (preferences: Preferences) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {useFilters().map(({ key, label, options }) => {
        const Icon = ICONS[key];
        return (
          <fieldset key={key} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4">
            <legend className="sr-only">{label}</legend>
            <span aria-hidden className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="size-4 text-accent" />
              {label}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[[null, t.filters.any] as const, ...options].map(([value, text]) => {
                const active = preferences[key] === value;
                return (
                  <button
                    key={text}
                    onClick={() => onChange({ ...preferences, [key]: value })}
                    aria-pressed={active}
                    className={`min-w-10 rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${
                      active ? "border-accent bg-accent font-semibold text-on-accent" : "border-line bg-field hover:border-ink/40"
                    }`}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
