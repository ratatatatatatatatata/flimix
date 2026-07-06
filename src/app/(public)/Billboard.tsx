"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type Hls from "hls.js";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Info, Play, Volume2, VolumeX } from "lucide-react";
import type { BillboardData } from "@/lib/catalog";
import { formatDuration, t } from "@/lib/i18n";

/* ------------------------------ trailer parsing ----------------------------- */

type TrailerMode =
  | { kind: "youtube"; videoId: string }
  | { kind: "file"; format: "progressive" | "hls"; url: string }
  | { kind: "none" };

/** Extract a YouTube video id from watch/youtu.be/embed/shorts URLs. */
function parseYouTubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const idPattern = /^[\w-]{6,}$/;
  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1] ?? "";
    return idPattern.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v") ?? "";
      return idPattern.test(id) ? id : null;
    }
    const match = url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{6,})/);
    return match?.[1] ?? null;
  }
  return null;
}

function resolveTrailerMode(trailerUrl: string | null): TrailerMode {
  if (!trailerUrl) return { kind: "none" };
  const youtubeId = parseYouTubeId(trailerUrl);
  if (youtubeId) return { kind: "youtube", videoId: youtubeId };
  const path = (trailerUrl.split(/[?#]/)[0] ?? trailerUrl).toLowerCase();
  if (path.endsWith(".m3u8")) return { kind: "file", format: "hls", url: trailerUrl };
  if (path.endsWith(".mp4") || path.endsWith(".webm")) {
    return { kind: "file", format: "progressive", url: trailerUrl };
  }
  return { kind: "none" };
}

function youtubeEmbedSrc(videoId: string, muted: boolean): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    controls: "0",
    loop: "1",
    playlist: videoId,
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/* -------------------------------- animation --------------------------------- */

/** Badge → title → meta → description → buttons, each fade + 20px slide-up. */
const contentVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const lineVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

/* --------------------------------- component -------------------------------- */

/**
 * Landing billboard — full-bleed hero that auto-plays the newest title's
 * trailer muted (YouTube iframe or direct file, HLS via lazy hls.js). Playback
 * starts only while the section is on screen and falls back to the static
 * backdrop (with a slow 24s CSS zoom) on error or reduced motion. The text
 * block reveals sequentially on mount via framer-motion variants.
 */
export function Billboard({ data }: { data: BillboardData }) {
  const mode = useMemo(() => resolveTrailerMode(data.trailerUrl), [data.trailerUrl]);

  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);

  // Reduced motion: static backdrop, no trailer, no entrance animation.
  const reducedMotion = useReducedMotion() ?? false;
  const playbackEnabled = mode.kind !== "none" && !failed && !reducedMotion;

  // Only run the trailer while the billboard is actually on screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Attach HLS trailers lazily (native on Safari, hls.js elsewhere).
  useEffect(() => {
    if (!playbackEnabled || mode.kind !== "file" || mode.format !== "hls") return;
    const video = videoRef.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = mode.url;
      return;
    }
    let hls: Hls | null = null;
    let cancelled = false;
    void import("hls.js").then(({ default: HlsCtor }) => {
      if (cancelled || !videoRef.current) return;
      if (!HlsCtor.isSupported()) {
        setFailed(true);
        return;
      }
      hls = new HlsCtor({ enableWorker: true });
      hls.on(HlsCtor.Events.ERROR, (_event, errorData) => {
        if (errorData.fatal) setFailed(true);
      });
      hls.loadSource(mode.url);
      hls.attachMedia(videoRef.current);
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [playbackEnabled, mode]);

  // Pause the file trailer when scrolled away, resume when back on screen.
  useEffect(() => {
    if (mode.kind !== "file") return;
    const video = videoRef.current;
    if (!video) return;
    if (visible && playbackEnabled) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [visible, playbackEnabled, mode.kind]);

  // Keep the media element's muted property in sync with the toggle.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const detailHref = data.type === "movie" ? `/movie/${data.slug}` : `/series/${data.slug}`;
  const watchHref = data.type === "movie" ? `/watch/movie/${data.id}` : detailHref;
  const metaParts: string[] = [
    ...(data.year ? [String(data.year)] : []),
    ...(data.ageRating ? [data.ageRating] : []),
    ...(data.durationSeconds ? [formatDuration(data.durationSeconds)] : []),
    ...data.genres,
  ];

  return (
    <section
      ref={sectionRef}
      aria-label={data.title}
      className="relative overflow-hidden bg-ink-950"
    >
      {/* Static backdrop — always rendered: poster while the trailer loads,
          and the sole visual when there is no playable trailer. The slow
          cinematic zoom is pure CSS (neutralized under reduced motion). */}
      {data.backdropUrl ? (
        <Image
          src={data.backdropUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-zoom object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-royal-800/40 via-ink-900 to-ink-950"
          aria-hidden="true"
        />
      )}

      {/* Trailer layer */}
      {playbackEnabled && mode.kind === "youtube" && visible ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <iframe
            key={muted ? "yt-muted" : "yt-unmuted"}
            src={youtubeEmbedSrc(mode.videoId, muted)}
            title={`${data.title} — трейлер`}
            allow="autoplay; encrypted-media"
            tabIndex={-1}
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-video min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 scale-125 border-0"
          />
        </div>
      ) : null}
      {playbackEnabled && mode.kind === "file" ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={data.backdropUrl ?? undefined}
          src={mode.format === "progressive" ? mode.url : undefined}
          onError={() => setFailed(true)}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {/* Legibility gradient */}
      <div className="absolute inset-0 bg-hero-fade" aria-hidden="true" />
      {/* Bottom blend into the first content row */}
      <div
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-[64vh] items-end md:min-h-[75vh]">
        <motion.div
          className="container-fx w-full pb-16 pt-36 sm:pb-28 sm:pt-48"
          variants={contentVariants}
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
        >
          <motion.div variants={lineVariants}>
            <span className="inline-flex items-center rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-accent">
              FLIMIX ОНЦЛОХ
            </span>
          </motion.div>
          <motion.h1
            variants={lineVariants}
            className="mt-3 max-w-2xl font-display text-2xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl"
          >
            {data.title}
          </motion.h1>
          {metaParts.length > 0 ? (
            <motion.p variants={lineVariants} className="mt-3 text-sm text-mist-300">
              {metaParts.join(" · ")}
            </motion.p>
          ) : null}
          {data.description ? (
            <motion.p
              variants={lineVariants}
              className="mt-4 hidden max-w-xl text-sm leading-relaxed text-mist-200 sm:block"
            >
              {data.description}
            </motion.p>
          ) : null}
          <motion.div
            variants={lineVariants}
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            <Link
              href={watchHref}
              className="btn-glow inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-7 py-3 font-medium text-white shadow-accent transition hover:brightness-110"
            >
              <Play size={18} fill="currentColor" aria-hidden="true" />
              {t.watchNow}
            </Link>
            {detailHref !== watchHref ? (
              <Link
                href={detailHref}
                className="btn-glow glass inline-flex items-center gap-2 rounded-lg px-7 py-3 font-medium text-mist-100 transition hover:text-white"
              >
                <Info size={18} aria-hidden="true" />
                Дэлгэрэнгүй
              </Link>
            ) : null}
            {playbackEnabled ? (
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                aria-label={muted ? "Дууг нээх" : "Дууг хаах"}
                aria-pressed={!muted}
                className="rounded-full border border-ink-600 bg-ink-950/70 p-3 text-mist-100 backdrop-blur transition hover:border-royal-500/60 hover:text-white"
              >
                {muted ? (
                  <VolumeX size={18} aria-hidden="true" />
                ) : (
                  <Volume2 size={18} aria-hidden="true" />
                )}
              </button>
            ) : null}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
