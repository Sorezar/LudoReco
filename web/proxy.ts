import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, hasLocale, type Locale } from "@/lib/i18n";

// Language chosen before with the switcher, else the browser's first supported one, else English
function preferredLocale(request: NextRequest): Locale {
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(chosen)) return chosen;
  const accepted = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => {
      const [tag, quality] = part.trim().split(";q=");
      return { language: tag.split("-")[0].toLowerCase(), quality: quality ? Number(quality) : 1 };
    })
    .sort((a, b) => b.quality - a.quality);
  return accepted.map(({ language }) => language).find(hasLocale) ?? DEFAULT_LOCALE;
}

// Every page lives under its language (/en, /fr...): the other addresses are redirected
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (hasLocale(pathname.split("/")[1])) return;
  request.nextUrl.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Pages only: not the API proxy, the Next.js files or the icon
  matcher: ["/((?!api|_next|icon|.*\\..*).*)"],
};
