"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FeaturedItem } from "@/lib/catalog";
import { t } from "@/lib/i18n";

const AUTO_ADVANCE_MS = 6000;
/** After a manual interaction the autoplay waits this long before resuming. */
const INTERACTION_GRACE_MS = 5000;

/**
 * Featured carousel — snap-scrolling wide backdrop cards with arrows, dots
 * and a gentle 6s auto-advance that pauses on hover/interaction.
 */
export function FeaturedCarousel({ items }: { items: FeaturedItem[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const lastInteractionRef = useRef(0);
  const programmaticUntilRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const scrollToIndex = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track || items.length === 0) return;
      const clamped = ((i % items.length) + items.length) % items.length;
      const child = track.children[clamped] as HTMLElement | undefined;
      if (!child) return;
      programmaticUntilRef.current = Date.now() + 900;
      track.scrollTo({
        left: child.offsetLeft - (track.clientWidth - child.clientWidth) / 2,
        behavior: "smooth",
      });
      setIndex(clamped);
    },
    [items.length],
  );

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    if (Date.now() > programmaticUntilRef.current) {
      lastInteractionRef.current = Date.now();
    }
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    Array.from(track.children).forEach((node, i) => {
      const el = node as HTMLElement;
      const mid = el.offsetLeft + el.clientWidth / 2;
      const dist = Math.abs(mid - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setIndex(best);
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      if (Date.now() - lastInteractionRef.current < INTERACTION_GRACE_MS) return;
      scrollToIndex(indexRef.current + 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [items.length, scrollToIndex]);

  const markInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Онцлох контент"
      className="relative animate-fade-in pt-6 sm:pt-10"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onFocus={() => {
        pausedRef.current = true;
      }}
      onBlur={() => {
        pausedRef.current = false;
      }}
      onTouchStart={markInteraction}
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="row-scroll relative flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:px-8"
      >
        {items.map((item, i) => (
          <Link
            key={`${item.type}-${item.id}`}
            href={item.type === "movie" ? `/movie/${item.slug}` : `/series/${item.slug}`}
            className="group relative aspect-video w-[70vw] max-w-3xl shrink-0 snap-center overflow-hidden rounded-xl border border-ink-600/40 bg-ink-800 shadow-card transition duration-300 hover:border-royal-500/50"
          >
            <Image
              src={item.backdropUrl}
              alt={item.title}
              fill
              priority={i === 0}
              sizes="(max-width: 768px) 70vw, 768px"
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-card-fade" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-royal-500/90 px-2.5 py-0.5 font-semibold text-white">
                  {item.type === "movie" ? t.movies : t.multiPart}
                </span>
                {item.year ? <span className="text-mist-300">{item.year}</span> : null}
                {item.genres.length > 0 ? (
                  <span className="text-mist-400">{item.genres.join(" · ")}</span>
                ) : null}
              </div>
              <h3 className="mt-2 font-display text-lg font-bold leading-tight text-white sm:text-2xl">
                {item.title}
              </h3>
            </div>
          </Link>
        ))}
      </div>

      {items.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Өмнөх"
            onClick={() => {
              markInteraction();
              scrollToIndex(indexRef.current - 1);
            }}
            className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-ink-600 bg-ink-950/80 p-2.5 text-mist-100 backdrop-blur transition hover:border-royal-500/60 hover:text-white md:flex"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Дараах"
            onClick={() => {
              markInteraction();
              scrollToIndex(indexRef.current + 1);
            }}
            className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-ink-600 bg-ink-950/80 p-2.5 text-mist-100 backdrop-blur transition hover:border-royal-500/60 hover:text-white md:flex"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>

          <div className="mt-4 flex justify-center gap-2">
            {items.map((item, i) => (
              <button
                key={`dot-${item.type}-${item.id}`}
                type="button"
                aria-label={`${i + 1}-р слайд`}
                aria-current={i === index}
                onClick={() => {
                  markInteraction();
                  scrollToIndex(i);
                }}
                className={
                  i === index
                    ? "h-1.5 w-6 rounded-full bg-royal-400 transition-all"
                    : "h-1.5 w-3 rounded-full bg-ink-600 transition-all hover:bg-ink-700"
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
