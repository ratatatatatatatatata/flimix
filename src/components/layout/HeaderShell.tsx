"use client";

import { useEffect, useState } from "react";

/**
 * Fixed header chrome that reacts to scroll (rAF-throttled): transparent
 * gradient while sitting over the billboard at the top of the page, solid
 * blurred ink once the visitor scrolls past ~40px.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setScrolled(window.scrollY > 40);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled
          ? "border-b border-ink-600/40 bg-ink-950/95 backdrop-blur"
          : "border-b border-transparent bg-gradient-to-b from-black/70 via-black/30 to-transparent"
      }`}
    >
      {children}
    </header>
  );
}
