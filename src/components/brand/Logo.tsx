import Link from "next/link";

/**
 * Official FLIMIX lockup — film-strip "F" with play triangle (violet→fuchsia
 * gradient) + spaced wordmark with gradient "X".
 * Vector recreation of the brand asset in public/brand/flimix-mark.svg.
 * Do not restyle or distort the mark.
 */
function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.15)}
      viewBox="0 0 320 368"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fxStrip" x1="40" y1="20" x2="300" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6d3bff" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="fxStripV" x1="20" y1="60" x2="120" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#a06bff" />
        </linearGradient>
        <linearGradient id="fxPlay" x1="150" y1="150" x2="295" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#e06bf0" />
        </linearGradient>
      </defs>
      <path fill="url(#fxStripV)" d="M20 96h85v238q0 18-16 18H36q-16 0-16-18V96Z" />
      <path fill="url(#fxStrip)" d="M105 15h153q52 0 52 50 0 35-38 35H105V15Z" />
      <path fill="url(#fxStrip)" d="M20 96V58q0-43 46-43h39v85H20Z" />
      <g fill="#0d0a16">
        <rect x="34" y="42" width="17" height="17" rx="4" />
        <rect x="34" y="73" width="17" height="17" rx="4" />
        <rect x="34" y="118" width="17" height="17" rx="4" />
        <rect x="34" y="149" width="17" height="17" rx="4" />
        <rect x="34" y="180" width="17" height="17" rx="4" />
        <rect x="34" y="211" width="17" height="17" rx="4" />
        <rect x="34" y="242" width="17" height="17" rx="4" />
        <rect x="34" y="273" width="17" height="17" rx="4" />
        <rect x="34" y="304" width="17" height="17" rx="4" />
      </g>
      <path fill="url(#fxPlay)" d="M155 141q-15-9-15 9v160q0 18 15 9l139-80q15-9 0-18l-139-80Z" />
    </svg>
  );
}

export function Logo({
  withLink = true,
  size = "md",
}: {
  withLink?: boolean;
  size?: "md" | "lg";
}) {
  const markSize = size === "lg" ? 40 : 26;
  const textCls =
    size === "lg"
      ? "text-3xl tracking-[0.3em]"
      : "text-lg tracking-[0.28em]";

  const lockup = (
    <span className="inline-flex select-none items-center gap-2.5">
      <Mark size={markSize} />
      <span className={`font-display font-semibold text-white ${textCls}`}>
        FLIMI
        <span className="bg-gradient-to-br from-royal-400 to-flare bg-clip-text text-transparent">
          X
        </span>
      </span>
    </span>
  );

  if (!withLink) return lockup;
  return (
    <Link href="/" aria-label="FLIMIX — Нүүр хуудас">
      {lockup}
    </Link>
  );
}
