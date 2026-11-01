import Image from "next/image";
import type { Game } from "@/lib/api";

// A game in a list: thumbnail, title, original title and year, and an action on the right
export default function GameRow({ game, children }: { game?: Game; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-accent-soft">
        {game?.thumbnail && <Image src={game.thumbnail} alt="" fill sizes="48px" className="object-cover" />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-semibold">{game?.name ?? "…"}</p>
        {game && (
          <p className="truncate text-muted">
            {game.name !== game.original_name && <>{game.original_name} · </>}
            {game.year}
          </p>
        )}
      </div>
      {children}
    </li>
  );
}
