"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CardReveal, CardsReveal } from "@/components/catalog/CardsReveal";

/**
 * Horizontal scroller for content rows: swipe/scroll on touch devices, hover
 * arrow overlays on desktop. Bleeds to the page edges (mirrors .container-fx
 * padding) and reserves vertical room so the poster hover-zoom never clips.
 * Cards reveal with a staggered fade + slide-up the first time the row
 * scrolls into view (CardsReveal — transform/opacity only, snap untouched).
 */
export function RowScroller({ children }: { children: React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.round(el.clientWidth * 0.9),
      behavior: "smooth",
    });
  }, []);

  const arrowClass =
    "absolute top-1/2 z-30 hidden h-28 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-ink-950/70 text-white opacity-0 shadow-card backdrop-blur-sm transition hover:bg-ink-800/90 focus-visible:opacity-100 group-hover/row:opacity-100 md:flex";

  return (
    <CardsReveal className="group/row relative">
      <div
        ref={scrollerRef}
        onScroll={updateArrows}
        className="row-scroll -mx-4 -my-4 flex snap-x gap-3 overflow-x-auto px-4 py-4 sm:-mx-6 sm:gap-4 sm:px-6 lg:-mx-10 lg:px-10"
      >
        {Children.map(children, (child) => (
          <CardReveal className="shrink-0 snap-start">{child}</CardReveal>
        ))}
      </div>
      {canPrev ? (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Өмнөх"
          className={`${arrowClass} -left-3 lg:-left-9`}
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
      ) : null}
      {canNext ? (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Дараах"
          className={`${arrowClass} -right-3 lg:-right-9`}
        >
          <ChevronRight size={26} aria-hidden="true" />
        </button>
      ) : null}
    </CardsReveal>
  );
}
