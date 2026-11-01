import { notFound } from "next/navigation";
import HomeLink from "@/components/HomeLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { MeepleIcon } from "@/components/Icons";
import Recommender from "@/components/Recommender";
import { getDictionary } from "@/lib/dictionaries";
import { hasLocale } from "@/lib/i18n";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4">
        <HomeLink href={`/${lang}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-on-accent shadow-sm">
            <MeepleIcon className="size-5" />
          </span>
          <span className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">{t.meta.title}</span>
        </HomeLink>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 flex-col pb-10 pt-2">
        <Recommender />
      </main>

      <footer className="border-t border-line py-6 text-sm text-muted">
        {t.footer.data}{" "}
        <a href="https://boardgamegeek.com" target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-accent">
          BoardGameGeek
        </a>
      </footer>
    </div>
  );
}
