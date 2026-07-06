"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/app/(public)/movie/actions";
import { t } from "@/lib/i18n";

/**
 * Small optimistic favorites heart for card hover overlays. Stops the click
 * from reaching the wrapping card link, flips instantly and reconciles with
 * the server action's answer (guests are redirected to /login by the action).
 */
export function CardFavorite({
  contentType,
  contentId,
  initialFavorited = false,
}: {
  contentType: "movie" | "series";
  contentId: string;
  initialFavorited?: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-pressed={favorited}
      aria-label={favorited ? t.removeFromList : t.addToList}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pending) return;
        const previous = favorited;
        setFavorited(!previous);
        startTransition(async () => {
          try {
            const res = await toggleFavorite({ contentType, contentId });
            setFavorited(res.favorited);
          } catch {
            setFavorited(previous);
          }
        });
      }}
      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-ink-950/70 text-mist-100 backdrop-blur-sm transition hover:border-royal-400/70 hover:text-white"
    >
      <Heart
        size={14}
        className={favorited ? "fill-royal-400 text-royal-400" : ""}
        aria-hidden="true"
      />
    </button>
  );
}
