import { Suspense } from "react";
import Link from "next/link";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import {
  getGenreCounts,
  getReleaseYears,
  getTopRatedTitles,
  type GenreCount,
  type TopRatedTitle,
} from "@/lib/catalog";
import { t } from "@/lib/i18n";

const menu = [
  { href: "/browse?type=movie", label: t.movies },
  { href: "/browse?type=series", label: t.multiPart },
  { href: "/browse", label: t.categories },
  { href: "/search", label: t.search },
  { href: "/subscribe", label: t.choosePlan },
  { href: "/#faq", label: t.faq },
  { href: "/#zaavar", label: "Тусламж" },
];

const socials: { label: string; href: string; Icon: typeof Facebook }[] = [
  { label: "FLIMIX Facebook хуудас", href: "#", Icon: Facebook },
  { label: "FLIMIX Instagram хуудас", href: "#", Icon: Instagram },
  { label: "FLIMIX YouTube суваг", href: "#", Icon: Youtube },
];

const legal = [
  { href: "/legal/terms", label: t.termsOfService },
  { href: "/legal/privacy", label: t.privacyPolicy },
  { href: "/legal/copyright", label: t.copyrightPolicy },
  { href: "/legal/content-removal", label: t.contentRemoval },
  { href: "/legal/refund", label: t.refundPolicy },
  { href: "/legal/child-safety", label: t.childSafety },
];

const linkClass = "transition hover:text-white";

function WidgetHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold text-white">{children}</h3>;
}

/* ------------------------------ data widgets ------------------------------- */

function GenresWidget({ genres }: { genres: GenreCount[] }) {
  if (genres.length === 0) return null;
  return (
    <nav aria-label={t.genre}>
      <WidgetHeading>{t.genre}</WidgetHeading>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-mist-400">
        {genres.map((g) => (
          <li key={g.slug}>
            <Link className={linkClass} href={`/browse?genre=${g.slug}`}>
              {g.name} ({g.count})
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function YearsWidget({ years }: { years: number[] }) {
  if (years.length === 0) return null;
  return (
    <nav aria-label={t.year}>
      <WidgetHeading>{t.year}</WidgetHeading>
      <ul className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm text-mist-400">
        {years.map((y) => (
          <li key={y}>
            <Link className={linkClass} href={`/browse?year=${y}`}>
              {y}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TopRatedWidget({ items }: { items: TopRatedTitle[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Шилдэг кинонууд">
      <WidgetHeading>Шилдэг кинонууд</WidgetHeading>
      <ul className="space-y-2 text-sm text-mist-400">
        {items.map((item) => (
          <li key={`${item.type}-${item.slug}`}>
            <Link
              className={`line-clamp-1 ${linkClass}`}
              href={`/${item.type}/${item.slug}`}
            >
              {item.title}
              {item.year ? ` (${item.year})` : ""}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The three data columns, resolved from the shared 60s "catalog" cache. Any
 * failure degrades to an empty area — the footer must never crash a page.
 */
async function FooterWidgets() {
  try {
    const [genres, years, topRated] = await Promise.all([
      getGenreCounts(),
      getReleaseYears(),
      getTopRatedTitles(8),
    ]);
    return (
      <>
        <GenresWidget genres={genres.slice(0, 14)} />
        <YearsWidget years={years.slice(0, 21)} />
        <TopRatedWidget items={topRated} />
      </>
    );
  } catch {
    return null;
  }
}

/* ---------------------------------- footer --------------------------------- */

/**
 * Link-widget footer: brand + menu, then genre / year / top-rated link columns
 * streamed in their own Suspense boundary so no page ever blocks on them.
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-600/40 bg-ink-900">
      <div className="container-fx grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-5">
          <Logo withLink={false} />
          <p className="max-w-xs text-sm text-mist-400">
            Монгол болон дэлхийн шилдэг кино, цувралуудыг нэг дороос.
          </p>
          <div className="flex items-center gap-1">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="rounded-lg p-2 text-mist-400 transition hover:text-royal-300"
              >
                <Icon size={18} aria-hidden="true" />
              </a>
            ))}
          </div>
          <nav aria-label="Цэс">
            <WidgetHeading>Цэс</WidgetHeading>
            <ul className="space-y-2 text-sm text-mist-400">
              {menu.map((m) => (
                <li key={m.href}>
                  <Link className={linkClass} href={m.href}>
                    {m.label}
                  </Link>
                </li>
              ))}
              <li>
                <a className={linkClass} href="mailto:info@flimix.mn">
                  Холбоо барих
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <Suspense fallback={null}>
          <FooterWidgets />
        </Suspense>
      </div>
      <div className="border-t border-ink-600/40">
        <nav
          aria-label="Хууль эрх зүй"
          className="container-fx flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-5 text-xs text-mist-500"
        >
          {legal.map((l) => (
            <Link key={l.href} className={linkClass} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-ink-600/40 py-5 text-center text-xs text-mist-500">
        © {new Date().getFullYear()} FLIMIX. {t.allRightsReserved}.
      </div>
    </footer>
  );
}
