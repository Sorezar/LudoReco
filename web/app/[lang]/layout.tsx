import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import { notFound } from "next/navigation";
import I18nProvider from "@/components/I18nProvider";
import { getDictionary } from "@/lib/dictionaries";
import { LOCALES, hasLocale } from "@/lib/i18n";
import "../globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

// One static page per language
export function generateStaticParams() {
  return Object.keys(LOCALES).map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = getDictionary(lang);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { languages: Object.fromEntries(Object.keys(LOCALES).map((code) => [code, `/${code}`])) },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <html lang={lang} className={`${fraunces.variable} ${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider lang={lang} dictionary={getDictionary(lang)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
