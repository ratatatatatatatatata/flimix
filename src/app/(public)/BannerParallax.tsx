"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";

/**
 * Backdrop layer for the editorial banner with a subtle scroll parallax:
 * the image (slightly overscaled so no edges show) drifts ±12px based on the
 * banner's position within the viewport. rAF-throttled, transform-only, and
 * fully disabled under reduced motion.
 */
export function BannerParallax({ imageUrl }: { imageUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    const layer = layerRef.current;
    if (!container || !layer) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = container.getBoundingClientRect();
      const viewportH = window.innerHeight;
      // -1 (below viewport) .. 0 (centered) .. 1 (above viewport)
      const raw =
        (viewportH / 2 - (rect.top + rect.height / 2)) /
        (viewportH / 2 + rect.height / 2);
      const progress = Math.max(-1, Math.min(1, raw));
      layer.style.transform = `translate3d(0, ${(progress * 12).toFixed(1)}px, 0) scale(1.06)`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [reducedMotion]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        ref={layerRef}
        className="absolute inset-0 will-change-transform"
        style={reducedMotion ? undefined : { transform: "scale(1.06)" }}
      >
        <Image src={imageUrl} alt="" fill sizes="100vw" className="object-cover" />
      </div>
    </div>
  );
}
