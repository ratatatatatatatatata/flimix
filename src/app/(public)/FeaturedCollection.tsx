import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { getEditorialCollection } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { BannerParallax } from "./BannerParallax";

/**
 * Editorial banner between the catalog rows and the marketing sections:
 * the first published "banner" CMS collection (artwork from its items), else
 * the most popular published title. The backdrop drifts a few pixels with
 * scroll via the BannerParallax client child. Renders nothing on an empty
 * catalog.
 */
export async function FeaturedCollection() {
  const banner = await getEditorialCollection();
  if (!banner) return null;

  return (
    <section
      aria-label={banner.title}
      className="relative flex items-center overflow-hidden rounded-2xl border border-ink-600/40 bg-ink-900 shadow-card sm:aspect-[21/9]"
    >
      {banner.backdropUrl ? (
        <BannerParallax imageUrl={banner.backdropUrl} />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-royal-800/40 via-ink-900 to-ink-950"
          aria-hidden="true"
        />
      )}
      {/* Left→right legibility gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/50 to-ink-950/10"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full p-5 py-10 sm:p-10">
        <div className="glass max-w-md rounded-2xl p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-royal-300">
            {banner.kind === "collection" ? "Онцлох багц" : "Онцлох контент"}
          </p>
          <h2 className="mt-2 font-display text-xl font-bold leading-tight text-white sm:text-3xl">
            {banner.title}
          </h2>
          {banner.description ? (
            <p className="mt-3 hidden text-sm leading-relaxed text-mist-300 sm:block">
              {banner.description}
            </p>
          ) : null}
          <Link
            href={banner.href}
            className="btn-glow mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-6 py-3 text-sm font-medium text-white shadow-accent transition hover:brightness-110"
          >
            {banner.kind === "collection" ? (
              <>
                Багц үзэх
                <ArrowRight size={16} aria-hidden="true" />
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" aria-hidden="true" />
                {t.watchNow}
              </>
            )}
          </Link>
        </div>
      </div>
    </section>
  );
}
