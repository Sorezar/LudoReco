"use client";

import { usePlayer } from "@/lib/player";

// Logo and name of the site: back to the welcome screen (the screen is kept in the browser, so a plain link would stay on it)
export default function HomeLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [, update] = usePlayer();

  function home(event: React.MouseEvent) {
    event.preventDefault();
    update((player) => ({ ...player, screen: "start" }));
    window.scrollTo({ top: 0 });
  }

  return (
    <a href={href} onClick={home} className="flex min-w-0 items-center gap-2.5">
      {children}
    </a>
  );
}
