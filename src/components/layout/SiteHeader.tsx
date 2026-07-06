import Link from "next/link";
import { Search, User } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { GenreMenu, type GenreLink } from "@/components/layout/GenreMenu";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";
import { getSession } from "@/lib/auth";
import { getGenreCounts } from "@/lib/catalog";
import { t } from "@/lib/i18n";

const primaryLinks: { href: string; label: string }[] = [
  { href: "/", label: "Эхлэл" },
  { href: "/browse?type=movie", label: t.movies },
  { href: "/browse?type=series", label: t.multiPart },
];

const guideLink: { href: string; label: string } = { href: "/#zaavar", label: "Заавар" };

/** Cached genre list for the dropdown; a failure just hides the menu item. */
async function getMenuGenres(): Promise<GenreLink[]> {
  try {
    const rows = await getGenreCounts();
    return rows.map((g) => ({ slug: g.slug, name: g.name }));
  } catch {
    return [];
  }
}

/** Global site header (server component — reads session + cached genres). */
export async function SiteHeader() {
  const [session, genres] = await Promise.all([getSession(), getMenuGenres()]);

  const mobileItems: MobileNavItem[] = [
    ...primaryLinks.map((l): MobileNavItem => ({ kind: "link", ...l })),
    ...(genres.length > 0
      ? [{ kind: "genres", label: t.categories, genres } satisfies MobileNavItem]
      : []),
    { kind: "link", ...guideLink },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600/40 bg-ink-950/85 backdrop-blur">
      <div className="container-fx flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-2 md:gap-8">
          <MobileNav items={mobileItems} />
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Үндсэн цэс">
            {primaryLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-mist-300 transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            {genres.length > 0 ? <GenreMenu genres={genres} /> : null}
            <Link
              href={guideLink.href}
              className="text-sm text-mist-300 transition hover:text-white"
            >
              {guideLink.label}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <HeaderSearch />
          <Link
            href="/search"
            aria-label={t.search}
            className="rounded-lg p-2 text-mist-300 transition hover:bg-ink-700 hover:text-white md:hidden"
          >
            <Search size={20} />
          </Link>
          {session ? (
            <Link
              href="/account"
              aria-label={t.myAccount}
              className="flex items-center gap-2 rounded-lg p-2 text-mist-300 transition hover:bg-ink-700 hover:text-white"
            >
              <User size={20} />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm text-mist-300 transition hover:text-white sm:block"
              >
                {t.signIn}
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-royal-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-royal-600"
              >
                {t.signUp}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
