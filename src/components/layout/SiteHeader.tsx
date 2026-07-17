import Link from "next/link";
import { signOutAction } from "@/app/account/actions";
import { Logo } from "@/components/brand/Logo";
import { GenreMenu, type GenreLink } from "@/components/layout/GenreMenu";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { HeaderShell } from "@/components/layout/HeaderShell";
import { MobileNav, type MobileNavItem } from "@/components/layout/MobileNav";
import {
  NotificationBell,
  type HeaderNotification,
} from "@/components/layout/NotificationBell";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { getSession, hasRole } from "@/lib/auth";
import { getGenreCounts, getTopRatedTitles } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";

const primaryLinks: { href: string; label: string }[] = [
  { href: "/", label: "Нүүр" },
  { href: "/browse?type=movie", label: t.movies },
  { href: "/browse?type=series", label: t.multiPart },
  { href: "/browse?sort=newest", label: "Шинээр нэмэгдсэн" },
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

/** Trending chip suggestions for the search overlay (cached, best-effort). */
async function getTrendingSuggestions(): Promise<{ title: string }[]> {
  try {
    const rows = await getTopRatedTitles(8);
    return rows.map((r) => ({ title: r.title }));
  } catch {
    return [];
  }
}

/** Latest five notifications for the bell; a failure shows an empty panel. */
async function getHeaderNotifications(userId: string): Promise<HeaderNotification[]> {
  try {
    const db = await createClient();
    const { data } = await db
      .from("notifications")
      .select("id, title_mn, body_mn, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    return (data ?? []) as HeaderNotification[];
  } catch {
    return [];
  }
}

/**
 * Global site header (server component — reads session + cached genres).
 * Rendered inside a fixed, scroll-aware shell that overlays the billboard.
 */
export async function SiteHeader() {
  const [session, genres, trending] = await Promise.all([
    getSession(),
    getMenuGenres(),
    getTrendingSuggestions(),
  ]);
  const notifications = session ? await getHeaderNotifications(session.userId) : [];

  const mobileItems: MobileNavItem[] = [
    ...primaryLinks.map((l): MobileNavItem => ({ kind: "link", ...l })),
    ...(genres.length > 0
      ? [{ kind: "genres", label: t.categories, genres } satisfies MobileNavItem]
      : []),
    { kind: "link", ...guideLink },
  ];

  const initial = (session?.email?.trim().charAt(0) ?? "F").toUpperCase();

  return (
    <HeaderShell>
      <div className="container-fx flex h-16 items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 md:gap-8">
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
        <div className="flex items-center gap-1.5 sm:gap-3">
          <HeaderSearch trending={trending} />
          {session ? (
            <>
              <NotificationBell notifications={notifications} />
              <ProfileMenu
                initial={initial}
                signOutAction={signOutAction}
                isAdmin={hasRole(session, "content_manager")}
              />
            </>
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
    </HeaderShell>
  );
}
