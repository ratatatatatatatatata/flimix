"use client";

import type Hls from "hls.js";
import {
  Check,
  Gauge,
  Headphones,
  Maximize,
  Minimize,
  Pause,
  Play,
  PictureInPicture2,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Subtitles as SubtitlesIcon,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

export interface PlayerSubtitle {
  label: string;
  src: string;
  lang: string;
  default?: boolean;
}

export interface PlayerAudioTrack {
  id: string;
  label: string;
  src: string;
  default?: boolean;
}

export interface VideoPlayerProps {
  hlsUrl: string;
  title: string;
  subtitles: PlayerSubtitle[];
  /**
   * Separately uploaded dub tracks. When at least one exists the video's own
   * audio is muted entirely and the default dub plays in sync instead.
   */
  audioTracks: PlayerAudioTrack[];
  startAt?: number;
  introStart?: number | null;
  introEnd?: number | null;
  nextHref?: string | null;
  onProgress?: (seconds: number, duration: number) => void;
}

interface QualityLevel {
  index: number;
  height: number;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SEEK_STEP_SECONDS = 10;
const CONTROLS_HIDE_MS = 3000;
const PROGRESS_INTERVAL_MS = 10_000;
const DOUBLE_TAP_MS = 280;
/** Dub sync: correct when audio drifts more than this many seconds from video. */
const DUB_DRIFT_TOLERANCE_S = 0.35;
const DUB_DRIFT_CHECK_MS = 2000;
const DUB_NOTICE_HIDE_MS = 6000;

type MenuKind = "speed" | "quality" | "subtitles" | "audio" | null;

function formatTimecode(value: number): string {
  const total = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function VideoPlayer({
  hlsUrl,
  title,
  subtitles,
  audioTracks,
  startAt,
  introStart,
  introEnd,
  nextHref,
  onProgress,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekWrapRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [errored, setErrored] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = auto
  const defaultSubtitle = subtitles.findIndex((s) => s.default === true);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(
    defaultSubtitle >= 0 ? defaultSubtitle : -1,
  );
  // Dub audio: replaces the original audio entirely while active.
  const defaultDubIndex = audioTracks.findIndex((track) => track.default === true);
  const [dubIndex, setDubIndex] = useState<number>(
    audioTracks.length > 0 ? (defaultDubIndex >= 0 ? defaultDubIndex : 0) : -1,
  );
  const [dubFailed, setDubFailed] = useState(false);
  const [dubNotice, setDubNotice] = useState<string | null>(null);
  const dubActive = audioTracks.length > 0 && !dubFailed;
  const activeDub = dubActive && dubIndex >= 0 ? audioTracks[dubIndex] : undefined;
  const [controlsVisible, setControlsVisible] = useState(true);
  const [openMenu, setOpenMenu] = useState<MenuKind>(null);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const reportProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    onProgressRef.current?.(video.currentTime, video.duration);
  }, []);

  /** (Re)attach the media source: native HLS on Safari, hls.js elsewhere. */
  const setup = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setErrored(false);
    setBuffering(true);
    setLevels([]);
    setCurrentLevel(-1);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.load();
      return;
    }

    const { default: HlsCtor } = await import("hls.js");
    if (!HlsCtor.isSupported()) {
      setErrored(true);
      return;
    }
    const hls = new HlsCtor({ enableWorker: true });
    hlsRef.current = hls;
    hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
      setLevels(
        hls.levels
          .map((level, index) => ({ index, height: level.height }))
          .sort((a, b) => b.height - a.height),
      );
    });
    hls.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
      } else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      } else {
        setErrored(true);
      }
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
  }, [hlsUrl]);

  useEffect(() => {
    void setup();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [setup]);

  // Progress heartbeat: every 10s while playing + on pause/unload (below).
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(reportProgress, PROGRESS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, reportProgress]);

  useEffect(() => {
    const handler = () => reportProgress();
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      reportProgress();
    };
  }, [reportProgress]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // React has no typed prop for the PiP lifecycle events; listen natively.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLeave = () => setPipActive(false);
    const onEnter = () => setPipActive(true);
    video.addEventListener("leavepictureinpicture", onLeave);
    video.addEventListener("enterpictureinpicture", onEnter);
    return () => {
      video.removeEventListener("leavepictureinpicture", onLeave);
      video.removeEventListener("enterpictureinpicture", onEnter);
    };
  }, []);

  // Subtitle selection drives native text tracks rendered from <track> tags.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i];
      if (track) track.mode = i === activeSubtitle ? "showing" : "disabled";
    }
  }, [activeSubtitle, buffering]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setControlsVisible(false);
        setOpenMenu(null);
      }
    }, CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.min(
        Math.max(0, video.currentTime + delta),
        video.duration || Number.MAX_SAFE_INTEGER,
      );
      showControls();
    },
    [showControls],
  );

  const setVolumeClamped = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  // Route volume/mute to whichever element is audible: while a dub is active
  // the <video> stays permanently muted and the <audio> element takes over.
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) {
      if (dubActive) {
        video.muted = true;
      } else {
        video.volume = volume;
        video.muted = muted;
      }
    }
    if (audio && dubActive) {
      audio.volume = volume;
      audio.muted = muted;
    }
  }, [volume, muted, dubActive, dubIndex]);

  // Dub sync engine: the <video> element is the clock, the <audio> element
  // follows every transport event and gets nudged back when it drifts.
  useEffect(() => {
    if (!dubActive) return;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    video.muted = true;
    const syncTime = () => {
      if (Number.isFinite(video.currentTime)) audio.currentTime = video.currentTime;
    };
    const playAudio = () => {
      void audio.play().catch(() => {
        /* interrupted by pause/src change — the next event resyncs */
      });
    };
    const onPlay = () => {
      syncTime();
      playAudio();
    };
    const onPause = () => audio.pause();
    const onRateChange = () => {
      audio.playbackRate = video.playbackRate;
    };
    const onWaiting = () => audio.pause();
    const onPlaying = () => {
      syncTime();
      if (!video.paused) playAudio();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeking", syncTime);
    video.addEventListener("seeked", syncTime);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    const driftTimer = setInterval(() => {
      if (video.paused || audio.readyState < 2) return;
      if (Math.abs(audio.currentTime - video.currentTime) > DUB_DRIFT_TOLERANCE_S) {
        syncTime();
      }
    }, DUB_DRIFT_CHECK_MS);

    audio.playbackRate = video.playbackRate;
    syncTime();
    if (!video.paused) playAudio();

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeking", syncTime);
      video.removeEventListener("seeked", syncTime);
      video.removeEventListener("ratechange", onRateChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      clearInterval(driftTimer);
      audio.pause();
    };
  }, [dubActive, dubIndex]);

  // Auto-hide the dub fallback notice.
  useEffect(() => {
    if (!dubNotice) return;
    const id = setTimeout(() => setDubNotice(null), DUB_NOTICE_HIDE_MS);
    return () => clearTimeout(id);
  }, [dubNotice]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
      } else {
        await video.requestPictureInPicture();
        setPipActive(true);
      }
    } catch {
      // PiP unavailable (permissions / unsupported) — ignore silently.
    }
  }, []);

  const changeSpeed = useCallback((next: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = next;
    setSpeed(next);
    setOpenMenu(null);
  }, []);

  const stepSpeed = useCallback(
    (direction: 1 | -1) => {
      const idx = SPEEDS.findIndex((s) => s === speed);
      const nextIdx = Math.min(SPEEDS.length - 1, Math.max(0, (idx < 0 ? 2 : idx) + direction));
      const next = SPEEDS[nextIdx];
      if (next !== undefined) changeSpeed(next);
    },
    [speed, changeSpeed],
  );

  const changeDub = useCallback((index: number) => {
    setDubIndex(index);
    setOpenMenu(null);
  }, []);

  const changeQuality = useCallback((levelIndex: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = levelIndex;
    setCurrentLevel(levelIndex);
    setOpenMenu(null);
  }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT") return;
      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          seekBy(-SEEK_STEP_SECONDS);
          break;
        case "ArrowRight":
          event.preventDefault();
          seekBy(SEEK_STEP_SECONDS);
          break;
        case "ArrowUp":
          event.preventDefault();
          setVolumeClamped(volume + 0.1);
          break;
        case "ArrowDown":
          event.preventDefault();
          setVolumeClamped(volume - 0.1);
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        case "<":
          stepSpeed(-1);
          break;
        case ">":
          stepSpeed(1);
          break;
        default:
          return;
      }
      showControls();
    },
    [togglePlay, seekBy, setVolumeClamped, volume, toggleFullscreen, toggleMute, stepSpeed, showControls],
  );

  /** Tap = toggle controls; double-tap left/right = seek (touch devices). */
  const onSurfacePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") {
        togglePlay();
        showControls();
        return;
      }
      const now = Date.now();
      const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
      const isDouble = now - lastTapRef.current < DOUBLE_TAP_MS;
      lastTapRef.current = now;
      if (isDouble) {
        if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
        const leftHalf = event.clientX - rect.left < rect.width / 2;
        seekBy(leftHalf ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
        return;
      }
      tapTimerRef.current = setTimeout(() => {
        setControlsVisible((visible) => {
          if (!visible) showControls();
          return !visible;
        });
      }, DOUBLE_TAP_MS);
    },
    [togglePlay, seekBy, showControls],
  );

  const onSeekHover = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const wrap = seekWrapRef.current;
      if (!wrap || duration <= 0) return;
      const rect = wrap.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      setHover({ x: ratio * rect.width, time: ratio * duration });
    },
    [duration],
  );

  const showSkipIntro =
    introStart !== null &&
    introStart !== undefined &&
    introEnd !== null &&
    introEnd !== undefined &&
    currentTime >= introStart &&
    currentTime < introEnd;

  const showNextEpisode =
    Boolean(nextHref) && duration > 0 && duration - currentTime <= 30;

  const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  const volumeIcon = useMemo(() => {
    if (muted || volume === 0) return <VolumeX className="h-5 w-5" aria-hidden="true" />;
    if (volume < 0.5) return <Volume1 className="h-5 w-5" aria-hidden="true" />;
    return <Volume2 className="h-5 w-5" aria-hidden="true" />;
  }, [muted, volume]);

  const menuButtonClass =
    "flex w-full items-center justify-between gap-4 rounded-md px-3 py-1.5 text-left text-sm text-mist-100 hover:bg-ink-700";

  return (
    <div
      ref={containerRef}
      className="group relative flex h-full w-full items-center justify-center overflow-hidden bg-black outline-none"
      tabIndex={0}
      role="region"
      aria-label={`Тоглуулагч: ${title}`}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- tracks rendered below */}
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onLoadedMetadata={(e) => {
          setBuffering(false);
          const video = e.currentTarget;
          if (startAt && startAt > 1 && startAt < (video.duration || Infinity) - 5) {
            video.currentTime = startAt;
          }
        }}
        onPlay={() => {
          setPlaying(true);
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          reportProgress();
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onEnded={reportProgress}
        onProgress={(e) => {
          const ranges = e.currentTarget.buffered;
          if (ranges.length > 0) setBufferedEnd(ranges.end(ranges.length - 1));
        }}
      >
        {subtitles.map((track, index) => (
          <track
            key={`${track.lang}-${index}`}
            kind="subtitles"
            src={track.src}
            srcLang={track.lang}
            label={track.label}
            default={index === activeSubtitle}
          />
        ))}
      </video>

      {/* Dub audio: replaces the original soundtrack while present */}
      {activeDub ? (
        {/* No crossOrigin here: plain media playback needs no CORS, and adding
            it makes the browser reject CDN hosts that don't send CORS headers. */}
        <audio
          ref={audioRef}
          src={activeDub.src}
          preload="auto"
          className="hidden"
          onLoadedMetadata={() => {
            const video = videoRef.current;
            const audio = audioRef.current;
            if (!video || !audio) return;
            audio.currentTime = video.currentTime;
            audio.playbackRate = video.playbackRate;
            if (!video.paused) {
              void audio.play().catch(() => {
                /* resynced on the next transport event */
              });
            }
          }}
          onError={() => {
            setDubFailed(true);
            setDubNotice("Дубляж ачаалагдсангүй — эх дуугаар тоглож байна");
          }}
        />
      ) : null}

      {/* Dub fallback notice */}
      {dubNotice ? (
        <p
          role="status"
          className="absolute left-1/2 top-6 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg border border-ink-600 bg-black/80 px-4 py-2 text-sm text-mist-100 backdrop-blur"
        >
          {dubNotice}
        </p>
      ) : null}

      {/* Tap / click surface */}
      <div
        className="absolute inset-0"
        onPointerUp={onSurfacePointerUp}
        aria-hidden="true"
      />

      {/* Buffering spinner */}
      {buffering && !errored ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-royal-500"
            role="status"
            aria-label={t.loading}
          />
        </div>
      ) : null}

      {/* Error overlay */}
      {errored ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
          <p className="text-lg font-medium text-white">{t.errorGeneric}</p>
          <Button
            variant="primary"
            onClick={() => {
              void setup();
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t.retry}
          </Button>
        </div>
      ) : null}

      {/* Skip intro */}
      {showSkipIntro && !errored ? (
        <button
          type="button"
          onClick={() => {
            if (introEnd !== null && introEnd !== undefined) {
              const video = videoRef.current;
              if (video) video.currentTime = introEnd;
            }
          }}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/30 bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white hover:text-black"
        >
          {t.skipIntro}
        </button>
      ) : null}

      {/* Next episode */}
      {showNextEpisode && nextHref && !errored ? (
        <Link
          href={nextHref}
          className="absolute bottom-28 right-6 z-20 inline-flex items-center gap-2 rounded-lg bg-royal-500 px-4 py-2 text-sm font-medium text-white shadow-accent transition hover:bg-royal-600"
        >
          <SkipForward className="h-4 w-4" aria-hidden="true" />
          {t.nextEpisode}
        </Link>
      ) : null}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-16 transition-opacity duration-300 ${
          controlsVisible || !playing ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* Title */}
        <p className="mb-2 truncate text-sm text-mist-300">{title}</p>

        {/* Seek bar */}
        <div
          ref={seekWrapRef}
          className="relative mb-3 h-4 cursor-pointer"
          onMouseMove={onSeekHover}
          onMouseLeave={() => setHover(null)}
        >
          {hover ? (
            <span
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-ink-800 px-1.5 py-0.5 text-xs text-white"
              style={{ left: hover.x }}
            >
              {formatTimecode(hover.time)}
            </span>
          ) : null}
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/30"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-royal-500"
              style={{ width: `${playedPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => {
              const video = videoRef.current;
              const next = Number(e.target.value);
              if (video) video.currentTime = next;
              setCurrentTime(next);
              showControls();
            }}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
            aria-label="Гүйлгэх"
            aria-valuetext={`${formatTimecode(currentTime)} / ${formatTimecode(duration)}`}
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-md p-2 text-white transition hover:bg-white/10"
            aria-label={playing ? "Түр зогсоох" : "Тоглуулах"}
          >
            {playing ? (
              <Pause className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Play className="h-6 w-6" aria-hidden="true" />
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-md p-2 text-white transition hover:bg-white/10"
              aria-label={muted ? "Дуу нээх" : "Дуу хаах"}
            >
              {volumeIcon}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVolumeClamped(Number(e.target.value))}
              className="hidden h-1 w-20 cursor-pointer accent-royal-500 sm:block"
              aria-label="Дууны түвшин"
            />
          </div>

          <span className="ml-1 text-xs tabular-nums text-mist-300 sm:text-sm">
            {formatTimecode(currentTime)} / {formatTimecode(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Speed */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "speed" ? null : "speed")}
                className="rounded-md p-2 text-white transition hover:bg-white/10"
                aria-label="Хурд"
                aria-expanded={openMenu === "speed"}
              >
                <Gauge className="h-5 w-5" aria-hidden="true" />
              </button>
              {openMenu === "speed" ? (
                <div className="absolute bottom-12 right-0 z-30 w-36 rounded-lg border border-ink-600 bg-ink-800/95 p-1 backdrop-blur">
                  <p className="px-3 py-1 text-xs uppercase tracking-wide text-mist-500">Хурд</p>
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" className={menuButtonClass} onClick={() => changeSpeed(s)}>
                      <span>{s === 1 ? "Энгийн" : `${s}x`}</span>
                      {speed === s ? <Check className="h-4 w-4 text-royal-400" aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Quality */}
            {levels.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "quality" ? null : "quality")}
                  className="rounded-md p-2 text-white transition hover:bg-white/10"
                  aria-label={t.quality}
                  aria-expanded={openMenu === "quality"}
                >
                  <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                </button>
                {openMenu === "quality" ? (
                  <div className="absolute bottom-12 right-0 z-30 w-36 rounded-lg border border-ink-600 bg-ink-800/95 p-1 backdrop-blur">
                    <p className="px-3 py-1 text-xs uppercase tracking-wide text-mist-500">{t.quality}</p>
                    <button type="button" className={menuButtonClass} onClick={() => changeQuality(-1)}>
                      <span>Авто</span>
                      {currentLevel === -1 ? <Check className="h-4 w-4 text-royal-400" aria-hidden="true" /> : null}
                    </button>
                    {levels.map((level) => (
                      <button
                        key={level.index}
                        type="button"
                        className={menuButtonClass}
                        onClick={() => changeQuality(level.index)}
                      >
                        <span>{level.height}p</span>
                        {currentLevel === level.index ? (
                          <Check className="h-4 w-4 text-royal-400" aria-hidden="true" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Dub audio tracks (original audio is intentionally not offered) */}
            {dubActive && audioTracks.length > 1 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "audio" ? null : "audio")}
                  className="rounded-md p-2 text-white transition hover:bg-white/10"
                  aria-label={t.audio}
                  aria-expanded={openMenu === "audio"}
                >
                  <Headphones className="h-5 w-5" aria-hidden="true" />
                </button>
                {openMenu === "audio" ? (
                  <div className="absolute bottom-12 right-0 z-30 w-44 rounded-lg border border-ink-600 bg-ink-800/95 p-1 backdrop-blur">
                    <p className="px-3 py-1 text-xs uppercase tracking-wide text-mist-500">{t.audio}</p>
                    {audioTracks.map((track, index) => (
                      <button
                        key={track.id}
                        type="button"
                        className={menuButtonClass}
                        onClick={() => changeDub(index)}
                      >
                        <span>{track.label}</span>
                        {dubIndex === index ? (
                          <Check className="h-4 w-4 text-royal-400" aria-hidden="true" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Subtitles */}
            {subtitles.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "subtitles" ? null : "subtitles")}
                  className="rounded-md p-2 text-white transition hover:bg-white/10"
                  aria-label={t.subtitles}
                  aria-expanded={openMenu === "subtitles"}
                >
                  <SubtitlesIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                {openMenu === "subtitles" ? (
                  <div className="absolute bottom-12 right-0 z-30 w-44 rounded-lg border border-ink-600 bg-ink-800/95 p-1 backdrop-blur">
                    <p className="px-3 py-1 text-xs uppercase tracking-wide text-mist-500">{t.subtitles}</p>
                    <button
                      type="button"
                      className={menuButtonClass}
                      onClick={() => {
                        setActiveSubtitle(-1);
                        setOpenMenu(null);
                      }}
                    >
                      <span>Идэвхгүй</span>
                      {activeSubtitle === -1 ? <Check className="h-4 w-4 text-royal-400" aria-hidden="true" /> : null}
                    </button>
                    {subtitles.map((track, index) => (
                      <button
                        key={`${track.lang}-${index}`}
                        type="button"
                        className={menuButtonClass}
                        onClick={() => {
                          setActiveSubtitle(index);
                          setOpenMenu(null);
                        }}
                      >
                        <span>{track.label}</span>
                        {activeSubtitle === index ? (
                          <Check className="h-4 w-4 text-royal-400" aria-hidden="true" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* PiP */}
            <button
              type="button"
              onClick={() => {
                void togglePip();
              }}
              className="hidden rounded-md p-2 text-white transition hover:bg-white/10 sm:block"
              aria-label="Зураг доторх зураг"
              aria-pressed={pipActive}
            >
              <PictureInPicture2 className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-md p-2 text-white transition hover:bg-white/10"
              aria-label={fullscreen ? "Дэлгэц дүүрэн горимоос гарах" : "Дэлгэц дүүрэн"}
            >
              {fullscreen ? (
                <Minimize className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Maximize className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
