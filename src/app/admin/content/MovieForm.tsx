"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { saveMovie, uploadImage, createCastMember, createCrewMember } from "./actions";
import type { ActionResult } from "../_lib/adminAction";
import { AudioTracksField, type AudioTrackDraft } from "../_components/AudioTracksField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type {
  CastMember,
  CrewMember,
  Country,
  Genre,
  Language,
  Movie,
  VideoAsset,
} from "@/types/db";
import { Plus, Trash2 } from "lucide-react";

const AGE_RATINGS = ["G", "PG", "PG-13", "R", "NC-17"] as const;
const QUALITIES = ["360p", "480p", "720p", "1080p", "2160p"] as const;
const PROVIDERS = ["bunny", "cloudflare", "aws", "mock", "r2"] as const;
const PROVIDER_LABELS: Record<(typeof PROVIDERS)[number], string> = {
  bunny: "bunny",
  cloudflare: "cloudflare",
  aws: "aws",
  mock: "mock",
  r2: "Cloudflare R2",
};

export interface SubtitleDraft {
  language_id: string;
  label: string;
  url: string;
  is_default: boolean;
}

export interface VideoDraft {
  provider: (typeof PROVIDERS)[number];
  provider_video_id: string;
  hls_path: string;
  qualities: string[];
}

export interface MovieFormProps {
  movie: Movie | null;
  genres: Genre[];
  countries: Country[];
  languages: Language[];
  castMembers: CastMember[];
  crewMembers: CrewMember[];
  selectedGenreIds: string[];
  selectedCastIds: string[];
  selectedCrewIds: string[];
  subtitles: SubtitleDraft[];
  audioTracks: AudioTrackDraft[];
  videoAsset: VideoAsset | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const sectionCls = "space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5";
const legendCls = "text-base font-medium text-white";
const selectCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500";

export function MovieForm(props: MovieFormProps) {
  const { movie } = props;
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    saveMovie,
    null,
  );

  // Titles + slug
  const [titleEn, setTitleEn] = useState(movie?.title_en ?? "");
  const [slug, setSlug] = useState(movie?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(movie));

  // Images
  const [posterUrl, setPosterUrl] = useState(movie?.poster_url ?? "");
  const [backdropUrl, setBackdropUrl] = useState(movie?.backdrop_url ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  // Cast / crew
  const [castMembers, setCastMembers] = useState(props.castMembers);
  const [crewMembers, setCrewMembers] = useState(props.crewMembers);
  const [castIds, setCastIds] = useState<string[]>(props.selectedCastIds);
  const [crewIds, setCrewIds] = useState<string[]>(props.selectedCrewIds);
  const [newCastName, setNewCastName] = useState("");
  const [newCrewName, setNewCrewName] = useState("");
  const [newCrewRole, setNewCrewRole] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();

  // Video
  const [hasVideo, setHasVideo] = useState(Boolean(props.videoAsset));
  const [video, setVideo] = useState<VideoDraft>({
    provider: props.videoAsset?.provider ?? "bunny",
    provider_video_id: props.videoAsset?.provider_video_id ?? "",
    hls_path: props.videoAsset?.hls_path ?? "",
    qualities: props.videoAsset?.qualities ?? ["720p", "1080p"],
  });

  // Subtitles
  const [subs, setSubs] = useState<SubtitleDraft[]>(props.subtitles);

  // Scheduling
  const [status, setStatus] = useState<"draft" | "scheduled" | "published">(
    movie && (movie.status === "draft" || movie.status === "scheduled" || movie.status === "published")
      ? movie.status
      : "draft",
  );

  const errorMsg = state && !state.ok ? state.error : null;

  const handleUpload = (kind: "poster" | "backdrop", file: File | null) => {
    if (!file) return;
    setUploadError(null);
    startUpload(async () => {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await uploadImage(fd);
      if (res.ok) {
        if (kind === "poster") setPosterUrl(res.data.url);
        else setBackdropUrl(res.data.url);
      } else {
        setUploadError(res.error);
      }
    });
  };

  const addCast = () => {
    if (!newCastName.trim()) return;
    setInlineError(null);
    startAdd(async () => {
      const res = await createCastMember(newCastName);
      if (res.ok) {
        setCastMembers((prev) => [...prev, res.data]);
        setCastIds((prev) => [...prev, res.data.id]);
        setNewCastName("");
      } else setInlineError(res.error);
    });
  };

  const addCrew = () => {
    if (!newCrewName.trim() || !newCrewRole.trim()) return;
    setInlineError(null);
    startAdd(async () => {
      const res = await createCrewMember(newCrewName, newCrewRole);
      if (res.ok) {
        setCrewMembers((prev) => [...prev, res.data]);
        setCrewIds((prev) => [...prev, res.data.id]);
        setNewCrewName("");
        setNewCrewRole("");
      } else setInlineError(res.error);
    });
  };

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const durationMinutes = useMemo(
    () => (movie?.duration_seconds ? Math.round(movie.duration_seconds / 60) : ""),
    [movie],
  );

  return (
    <form action={formAction} className="space-y-6">
      {movie ? <input type="hidden" name="id" value={movie.id} /> : null}
      <input type="hidden" name="cast_ids_json" value={JSON.stringify(castIds)} />
      <input type="hidden" name="crew_ids_json" value={JSON.stringify(crewIds)} />
      <input type="hidden" name="subtitles_json" value={JSON.stringify(subs)} />
      <input type="hidden" name="video_json" value={hasVideo ? JSON.stringify(video) : ""} />
      <input type="hidden" name="poster_url" value={posterUrl} />
      <input type="hidden" name="backdrop_url" value={backdropUrl} />

      {errorMsg ? (
        <div role="alert" className="rounded-lg border border-red-700/40 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </div>
      ) : null}

      {/* Titles */}
      <fieldset className={sectionCls}>
        <legend className={legendCls}>Нэр ба тайлбар</legend>
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Монгол нэр *" name="title_mn" defaultValue={movie?.title_mn ?? ""} required />
          <Input
            label="Англи нэр"
            name="title_en"
            value={titleEn}
            onChange={(e) => {
              setTitleEn(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
          <Input label="Эх нэр" name="original_title" defaultValue={movie?.original_title ?? ""} />
        </div>
        <Input
          label="Slug (URL хаяг) *"
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="description_mn" className="block text-sm text-mist-300">
              Монгол тайлбар
            </label>
            <textarea
              id="description_mn"
              name="description_mn"
              rows={4}
              defaultValue={movie?.description_mn ?? ""}
              className="w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="description_en" className="block text-sm text-mist-300">
              Англи тайлбар
            </label>
            <textarea
              id="description_en"
              name="description_en"
              rows={4}
              defaultValue={movie?.description_en ?? ""}
              className="w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Metadata */}
      <fieldset className={sectionCls}>
        <legend className={legendCls}>Мэдээлэл</legend>
        <div className="grid gap-4 md:grid-cols-4">
          <Input label="Гарсан он" name="release_year" type="number" min={1900} max={2100} defaultValue={movie?.release_year ?? ""} />
          <Input label="Үргэлжлэх (минут)" name="duration_minutes" type="number" min={0} defaultValue={durationMinutes} />
          <div className="space-y-1.5">
            <label htmlFor="age_rating" className="block text-sm text-mist-300">Насны ангилал</label>
            <select id="age_rating" name="age_rating" defaultValue={movie?.age_rating ?? ""} className={selectCls}>
              <option value="">— Сонгох —</option>
              {AGE_RATINGS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="country_id" className="block text-sm text-mist-300">Улс</label>
            <select id="country_id" name="country_id" defaultValue={movie?.country_id ?? ""} className={selectCls}>
              <option value="">— Сонгох —</option>
              {props.countries.map((c) => (
                <option key={c.id} value={c.id}>{c.name_mn}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-mist-300">Төрөл (жанр)</p>
          <div className="flex flex-wrap gap-2">
            {props.genres.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs text-mist-300 has-[:checked]:border-royal-500/60 has-[:checked]:bg-royal-700/30 has-[:checked]:text-royal-300">
                <input
                  type="checkbox"
                  name="genre_ids"
                  value={g.id}
                  defaultChecked={props.selectedGenreIds.includes(g.id)}
                  className="sr-only"
                />
                {g.name_mn}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/* Media */}
      <fieldset className={sectionCls}>
        <legend className={legendCls}>Зураг ба трейлер</legend>
        <p className="text-xs text-mist-500">
          Зургийг Supabase Storage-ийн “media” bucket руу шууд байршуулна (JPEG/PNG/WEBP, ≤5MB) эсвэл URL оруулна.
        </p>
        {uploadError ? <p role="alert" className="text-sm text-red-400">{uploadError}</p> : null}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Input label="Постер URL" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://..." />
            <label className="block text-sm text-mist-400">
              Постер байршуулах
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleUpload("poster", e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-mist-400 file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-mist-200"
              />
            </label>
            {posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="Постерын урьдчилсан харагдац" className="h-48 w-32 rounded-lg object-cover" />
            ) : null}
          </div>
          <div className="space-y-3">
            <Input label="Арын зураг URL" value={backdropUrl} onChange={(e) => setBackdropUrl(e.target.value)} placeholder="https://..." />
            <label className="block text-sm text-mist-400">
              Арын зураг байршуулах
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleUpload("backdrop", e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-mist-400 file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-mist-200"
              />
            </label>
            {backdropUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={backdropUrl} alt="Арын зургийн урьдчилсан харагдац" className="h-32 w-full rounded-lg object-cover" />
            ) : null}
          </div>
        </div>
        {uploading ? <p className="text-sm text-royal-300">Байршуулж байна...</p> : null}
        <Input label="Трейлер URL" name="trailer_url" type="url" defaultValue={movie?.trailer_url ?? ""} placeholder="https://..." />
      </fieldset>

      {/* Video asset */}
      <fieldset className={sectionCls}>
        <legend className={legendCls}>Видео (playback asset)</legend>
        <label className="flex items-center gap-2 text-sm text-mist-300">
          <input
            type="checkbox"
            checked={hasVideo}
            onChange={(e) => setHasVideo(e.target.checked)}
            className="h-4 w-4 accent-royal-500"
          />
          Видео ассет холбох / шинэчлэх
        </label>
        {hasVideo ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="v_provider" className="block text-sm text-mist-300">Провайдер</label>
              <select
                id="v_provider"
                value={video.provider}
                onChange={(e) => setVideo({ ...video, provider: e.target.value as VideoDraft["provider"] })}
                className={selectCls}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <Input
              label="Провайдерын видео ID"
              value={video.provider_video_id}
              onChange={(e) => setVideo({ ...video, provider_video_id: e.target.value })}
            />
            <Input
              label="HLS зам (playlist)"
              value={video.hls_path}
              onChange={(e) => setVideo({ ...video, hls_path: e.target.value })}
              placeholder="videos/abc/playlist.m3u8"
            />
            <div className="md:col-span-3">
              <p className="mb-2 text-sm text-mist-300">Чанарууд</p>
              <div className="flex flex-wrap gap-2">
                {QUALITIES.map((qual) => (
                  <label key={qual} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs text-mist-300 has-[:checked]:border-royal-500/60 has-[:checked]:text-royal-300">
                    <input
                      type="checkbox"
                      checked={video.qualities.includes(qual)}
                      onChange={() => setVideo({ ...video, qualities: toggleId(video.qualities, qual) })}
                      className="sr-only"
                    />
                    {qual}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </fieldset>

      {/* Cast & crew */}
      <fieldset className={sectionCls}>
        <legend className={legendCls}>Жүжигчид ба баг</legend>
        {inlineError ? <p role="alert" className="text-sm text-red-400">{inlineError}</p> : null}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-mist-300">Жүжигчид ({castIds.length})</p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-600 bg-ink-900 p-2">
              {castMembers.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-mist-300 hover:bg-ink-800">
                  <input
                    type="checkbox"
                    checked={castIds.includes(c.id)}
                    onChange={() => setCastIds((prev) => toggleId(prev, c.id))}
                    className="h-3.5 w-3.5 accent-royal-500"
                  />
                  {c.name}
                </label>
              ))}
              {castMembers.length === 0 ? <p className="px-2 py-1 text-xs text-mist-500">Бүртгэл алга</p> : null}
            </div>
            <div className="mt-2 flex gap-2">
              <Input placeholder="Шинэ жүжигчний нэр" value={newCastName} onChange={(e) => setNewCastName(e.target.value)} aria-label="Шинэ жүжигчний нэр" />
              <Button type="button" variant="secondary" size="sm" onClick={addCast} loading={adding}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Нэмэх
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-mist-300">Багийн гишүүд ({crewIds.length})</p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-600 bg-ink-900 p-2">
              {crewMembers.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-mist-300 hover:bg-ink-800">
                  <input
                    type="checkbox"
                    checked={crewIds.includes(c.id)}
                    onChange={() => setCrewIds((prev) => toggleId(prev, c.id))}
                    className="h-3.5 w-3.5 accent-royal-500"
                  />
                  {c.name} <span className="text-xs text-mist-500">({c.role})</span>
                </label>
              ))}
              {crewMembers.length === 0 ? <p className="px-2 py-1 text-xs text-mist-500">Бүртгэл алга</p> : null}
            </div>
            <div className="mt-2 flex gap-2">
              <Input placeholder="Нэр" value={newCrewName} onChange={(e) => setNewCrewName(e.target.value)} aria-label="Шинэ багийн гишүүний нэр" />
              <Input placeholder="Үүрэг (director...)" value={newCrewRole} onChange={(e) => setNewCrewRole(e.target.value)} aria-label="Багийн гишүүний үүрэг" />
              <Button type="button" variant="secondary" size="sm" onClick={addCrew} loading={adding}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Нэмэх
              </Button>
            </div>
          </div>
        </div>
      </fieldset>

      {/* Subtitles */}
      <fieldset className={sectionCls}>
        <legend className={legendCls}>Хадмал орчуулга</legend>
        {subs.map((s, i) => (
          <div key={i} className="grid items-end gap-3 rounded-lg border border-ink-700 bg-ink-900/60 p-3 md:grid-cols-[1fr_1fr_2fr_auto_auto]">
            <div className="space-y-1.5">
              <label htmlFor={`sub_lang_${i}`} className="block text-sm text-mist-300">Хэл</label>
              <select
                id={`sub_lang_${i}`}
                value={s.language_id}
                onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, language_id: e.target.value } : x)))}
                className={selectCls}
              >
                <option value="">— Хэл —</option>
                {props.languages.map((l) => (
                  <option key={l.id} value={l.id}>{l.name_mn}</option>
                ))}
              </select>
            </div>
            <Input label="Шошго" value={s.label} onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input label="URL (.vtt)" value={s.url} onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <label className="flex items-center gap-2 pb-2.5 text-sm text-mist-300">
              <input
                type="checkbox"
                checked={s.is_default}
                onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, is_default: e.target.checked } : { ...x, is_default: e.target.checked ? false : x.is_default })))}
                className="h-4 w-4 accent-royal-500"
              />
              Үндсэн
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSubs(subs.filter((_, j) => j !== i))} aria-label="Хадмал устгах">
              <Trash2 className="h-4 w-4 text-red-400" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setSubs([...subs, { language_id: props.languages[0]?.id ?? "", label: "", url: "", is_default: subs.length === 0 }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Хадмал нэмэх
        </Button>
      </fieldset>

      {/* Dub audio */}
      <fieldset className={sectionCls}>
        <legend className={legendCls}>Дуу оруулах (дубляж)</legend>
        <AudioTracksField languages={props.languages} initial={props.audioTracks} idPrefix="movie" />
      </fieldset>

      {/* Publishing */}
      <fieldset className={sectionCls}>
        <legend className={legendCls}>Нийтлэлт</legend>
        <div className="grid items-end gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="status" className="block text-sm text-mist-300">Төлөв</label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={selectCls}
            >
              <option value="draft">Ноорог</option>
              <option value="scheduled">Товлох</option>
              <option value="published">Нийтлэх</option>
            </select>
          </div>
          {status !== "draft" ? (
            <Input
              label={status === "scheduled" ? "Нийтлэгдэх огноо *" : "Нийтэлсэн огноо"}
              name="published_at"
              type="datetime-local"
              defaultValue={toLocalDatetime(movie?.published_at ?? null)}
              required={status === "scheduled"}
            />
          ) : null}
          <label className="flex items-center gap-2 pb-2.5 text-sm text-mist-300">
            <input type="checkbox" name="is_free" defaultChecked={movie?.is_free ?? false} className="h-4 w-4 accent-royal-500" />
            Үнэгүй үзэх боломжтой
          </label>
        </div>
        {status === "published" ? (
          <div className="flex items-center gap-2">
            <Badge tone="warning">Анхаар</Badge>
            <p className="text-xs text-mist-400">
              Нийтлэхийн тулд баталгаажсан, хүчинтэй контентын эрх бүртгэгдсэн байх шаардлагатай.
            </p>
          </div>
        ) : null}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {movie ? "Хадгалах" : "Кино үүсгэх"}
        </Button>
        <p className="text-xs text-mist-500">Төлөв “Ноорог” үед сайтад харагдахгүй.</p>
      </div>
    </form>
  );
}
