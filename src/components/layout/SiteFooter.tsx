import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { t } from "@/lib/i18n";

const legal = [
  { href: "/legal/terms", label: t.termsOfService },
  { href: "/legal/privacy", label: t.privacyPolicy },
  { href: "/legal/copyright", label: t.copyrightPolicy },
  { href: "/legal/content-removal", label: t.contentRemoval },
  { href: "/legal/refund", label: t.refundPolicy },
  { href: "/legal/child-safety", label: t.childSafety },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-600/40 bg-ink-900">
      <div className="container-fx grid gap-10 py-12 md:grid-cols-3">
        <div className="space-y-4">
          <Logo withLink={false} />
          <p className="max-w-xs text-sm text-mist-400">
            Монгол болон дэлхийн шилдэг кино, цувралуудыг нэг дороос.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Цэс</h3>
          <ul className="space-y-2 text-sm text-mist-400">
            <li><Link className="hover:text-white" href="/browse?type=movie">{t.movies}</Link></li>
            <li><Link className="hover:text-white" href="/browse?type=series">{t.multiPart}</Link></li>
            <li><Link className="hover:text-white" href="/browse">{t.categories}</Link></li>
            <li><Link className="hover:text-white" href="/search">{t.search}</Link></li>
            <li><Link className="hover:text-white" href="/subscribe">{t.choosePlan}</Link></li>
            <li><Link className="hover:text-white" href="/#faq">{t.faq}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Хууль эрх зүй</h3>
          <ul className="space-y-2 text-sm text-mist-400">
            {legal.map((l) => (
              <li key={l.href}>
                <Link className="hover:text-white" href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-600/40 py-5 text-center text-xs text-mist-500">
        © {new Date().getFullYear()} FLIMIX. {t.allRightsReserved}.
      </div>
    </footer>
  );
}
