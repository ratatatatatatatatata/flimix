"use client";

import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  VideoPlayer,
  type PlayerAudioTrack,
  type PlayerSubtitle,
} from "@/components/player/VideoPlayer";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { SubtitleTrack } from "@/types/db";

interface WatchClientProps {
  contentType: "movie" | "episode";
  contentId: string;
  title: string;
  backHref: string;
  introStart?: number | null;
  introEnd?: number | null;
  nextHref?: string | null;
}

interface PlaybackAudioTrackDto {
  id: string;
  label: string;
  url: string;
  isDefault: boolean;
  language: string | null;
}

interface PlaybackResponse {
  hlsUrl: string;
  expiresAt: string;
  subtitles: SubtitleTrack[];
  audioTracks: PlaybackAudioTrackDto[];
  progressSeconds: number;
  sessionId: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; playback: PlaybackResponse };

export function WatchClient({
  contentType,
  contentId,
  title,
  backHref,
  introStart,
  introEnd,
  nextHref,
}: WatchClientProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId }),
      });
      if (res.status === 403) {
        setState({ kind: "forbidden" });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setState({ kind: "error", message: body?.error ?? t.errorGeneric });
        return;
      }
      const playback = (await res.json()) as PlaybackResponse;
      setState({ kind: "ready", playback });
    } catch {
      setState({ kind: "error", message: t.errorGeneric });
    }
  }, [contentType, contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleProgress = useCallback(
    (seconds: number, duration: number) => {
      if (state.kind !== "ready") return;
      void fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          contentType,
          contentId,
          progressSeconds: seconds,
          durationSeconds: duration,
          sessionId: state.playback.sessionId,
        }),
      }).catch(() => {
        /* progress writes are best-effort */
      });
    },
    [state, contentType, contentId],
  );

  const subtitles: PlayerSubtitle[] =
    state.kind === "ready"
      ? state.playback.subtitles.map((track) => ({
          label: track.label,
          src: track.url,
          lang: track.language?.code ?? "mn",
          default: track.is_default,
        }))
      : [];

  const audioTracks: PlayerAudioTrack[] =
    state.kind === "ready"
      ? state.playback.audioTracks.map((track) => ({
          id: track.id,
          label: track.label,
          src: track.url,
          default: track.isDefault,
        }))
      : [];

  return (
    <div className="relative h-dvh w-full bg-black">
      {/* Back to detail page. Plain <a> on purpose: a hard navigation
          bypasses the (.)movie/(.)series route interception, which 404s when
          soft-navigating out of /watch (it lives outside the (public) group). */}
      <a
        href={backHref}
        className="absolute left-4 top-4 z-40 inline-flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-sm text-mist-100 backdrop-blur transition hover:bg-black/80 hover:text-white"
        aria-label={t.back}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t.back}</span>
      </a>

      {state.kind === "loading" ? (
        <div className="flex h-full items-center justify-center">
          <span
            className="h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-royal-500"
            role="status"
            aria-label={t.loading}
          />
        </div>
      ) : null}

      {state.kind === "forbidden" ? (
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-800">
            <Lock className="h-7 w-7 text-royal-400" aria-hidden="true" />
          </span>
          <h1 className="max-w-md text-xl font-semibold text-white">
            {t.subscriptionRequired}
          </h1>
          <p className="max-w-md text-sm text-mist-400">
            Багц идэвхжүүлснээр FLIMIX-ийн бүх контентыг хязгааргүй үзэх боломжтой.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/subscribe"
              className="inline-flex items-center justify-center rounded-lg bg-royal-500 px-5 py-2.5 text-sm font-medium text-white shadow-accent transition hover:bg-royal-600"
            >
              {t.choosePlan}
            </Link>
            <a
              href={backHref}
              className="inline-flex items-center justify-center rounded-lg border border-ink-600 bg-ink-700 px-5 py-2.5 text-sm font-medium text-mist-100 transition hover:border-royal-500/60"
            >
              {t.back}
            </a>
          </div>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="max-w-md text-lg font-medium text-white">{state.message}</p>
          <Button
            variant="primary"
            onClick={() => {
              void load();
            }}
          >
            {t.retry}
          </Button>
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <VideoPlayer
          hlsUrl={state.playback.hlsUrl}
          title={title}
          subtitles={subtitles}
          audioTracks={audioTracks}
          startAt={state.playback.progressSeconds}
          introStart={introStart ?? null}
          introEnd={introEnd ?? null}
          nextHref={nextHref ?? null}
          onProgress={handleProgress}
        />
      ) : null}
    </div>
  );
}
