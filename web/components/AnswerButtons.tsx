"use client";

import { ANSWERS, answerOf, type Answer } from "@/lib/player";
import { useI18n } from "./I18nProvider";
import { HeartIcon, ThumbDownIcon, ThumbUpIcon } from "./Icons";

const ITEMS: { answer: Answer; icon: typeof HeartIcon; selected: string }[] = [
  { answer: "dislike", icon: ThumbDownIcon, selected: "border-ink bg-ink text-paper" },
  { answer: "ok", icon: ThumbUpIcon, selected: "border-sun bg-sun text-ink" },
  { answer: "love", icon: HeartIcon, selected: "border-rose-500 bg-rose-500 text-white" },
];

// Didn't like / it's OK / loved: big buttons with labels, or small round ones in lists
export default function AnswerButtons({
  value,
  onAnswer,
  small = false,
}: {
  value?: number; // the player's rating of this game, if any
  onAnswer: (rating: number) => void;
  small?: boolean;
}) {
  const { t } = useI18n();
  const current = value === undefined ? null : answerOf(value);

  return (
    <div className={small ? "flex gap-1.5" : "grid grid-cols-3 gap-2"}>
      {ITEMS.map(({ answer, icon: Icon, selected }) => {
        const active = answer === current;
        return (
          <button
            key={answer}
            onClick={() => onAnswer(ANSWERS[answer])}
            aria-pressed={active}
            aria-label={t.answers[answer]}
            title={t.answers[answer]}
            className={`border transition active:scale-95 ${
              small
                ? "grid size-9 place-items-center rounded-full"
                : "flex flex-col items-center gap-1.5 rounded-2xl py-3.5 text-sm font-semibold"
            } ${active ? selected : "border-line bg-card hover:border-ink/40"}`}
          >
            <Icon className={small ? "size-4" : "size-6"} />
            {!small && t.answers[answer]}
          </button>
        );
      })}
    </div>
  );
}
