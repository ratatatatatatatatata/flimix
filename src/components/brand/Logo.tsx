import Link from "next/link";

/**
 * FLIMIX wordmark + film-strip "F" symbol.
 * NOTE: replace the inline SVG with the official brand asset
 * (public/brand/flimix-logo.svg) when provided. Do not restyle the mark.
 */
export function Logo({ withLink = true }: { withLink?: boolean }) {
  const mark = (
    <span className="inline-flex items-center gap-2 select-none">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="28" height="28" rx="6" fill="#8b5cf6" />
        {/* film-strip perforations */}
        <rect x="5" y="5" width="3" height="3" rx="1" fill="#07060a" />
        <rect x="5" y="10.5" width="3" height="3" rx="1" fill="#07060a" />
        <rect x="5" y="16" width="3" height="3" rx="1" fill="#07060a" />
        <rect x="5" y="21.5" width="3" height="3" rx="1" fill="#07060a" />
        {/* F letterform */}
        <path
          d="M12 7h13v4h-9v3.5h7.5v4H16V25h-4V7z"
          fill="#07060a"
        />
      </svg>
      <span className="font-display text-xl font-bold tracking-wide text-white">
        FLIMIX
      </span>
    </span>
  );
  if (!withLink) return mark;
  return (
    <Link href="/" aria-label="FLIMIX — Нүүр хуудас">
      {mark}
    </Link>
  );
}
