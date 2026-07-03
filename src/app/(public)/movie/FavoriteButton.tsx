"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { t } from "@/lib/i18n";
import { toggleFavorite } from "./actions";

/** Favorites toggle — shared by movie and series detail pages. */
export function FavoriteButton({
  contentType,
  contentId,
  path,
  initialFavorited,
}: {
  contentType: "movie" | "series";
  contentId: string;
  path: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={favorited}
      onClick={() =>
        startTransition(async () => {
          const res = await toggleFavorite({ contentType, contentId, path });
          setFavorited(res.favorited);
        })
      }
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        favorited
          ? "border-royal-500/60 bg-royal-700/25 text-royal-300 hover:bg-royal-700/40"
          : "border-ink-600 bg-ink-700 text-mist-100 hover:border-royal-500/60"
      }`}
    >
      <Heart
        size={17}
        className={favorited ? "fill-royal-400 text-royal-400" : ""}
        aria-hidden="true"
      />
      {favorited ? t.removeFromList : t.addToList}
    </button>
  );
}
