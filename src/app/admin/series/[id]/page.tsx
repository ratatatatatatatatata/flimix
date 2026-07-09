import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { SeriesFields } from "../SeriesFields";
import { saveSeries, softDeleteSeries, addSeason, deleteSeason, saveEpisode, deleteEpisode } from "../actions";
import { MessageBanner } from "../../_components/MessageBanner";
import { contentStatusLabel, contentStatusTone } from "../../_lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";
import type { Country, Episode, Genre, Language, Season, Series, VideoAsset } from "@/types/db";
import { AudioTracksField, type AudioTrackDraft } from "../../_components/AudioTracksField";

export const dynamic = "force-dynamic";

const QUALITIES = ["360p", "480p", "720p", "1080p", "2160p"] as const;
const selectCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500";

function EpisodeForm({
  seriesId,
  seasonId,
  episode,
  asset,
  nextNumber,
  languages,
  audioTracks,
}: {
  seriesId: string;
  seasonId: string;
  episode: Episode | null;
  asset: VideoAsset | null;
  nextNumber: number;
  languages: Language[];
  audioTracks: AudioTrackDraft[];
}) {
  const idp = episode ? `ep-${episode.id}` : `new-${seasonId}`;
  return (
    <form action={saveEpisode} className="space-y-4">
      <input type="hidden" name="series_id" value={seriesId} />
      <input type="hidden" name="season_id" value={seasonId} />
      {episode ? <input type="hidden" name="id" value={episode.id} /> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Input label="Дугаар *" name="episode_number" type="number" min={1} defaultValue={episode?.episode_number ?? nextNumber} required />
        <Input label="Нэр (MN) *" name="title_mn" defaultValue={episode?.title_mn ?? ""} required />
        <Input label="Нэр (EN)" name="title_en" defaultValue={episode?.title_en ?? ""} />
        <Input
          label="Үргэлжлэх (минут)"
          name="duration_minutes"
          type="number"
          min={0}
          defaultValue={episode?.duration_seconds ? Math.round(episode.duration_seconds / 60) : ""}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idp}-desc`} className="block text-sm text-mist-300">Тайлбар</label>
        <textarea
          id={`${idp}-desc`}
          name="description_mn"
          rows={2}
          defaultValue={episode?.description_mn ?? ""}
          className="w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Input label="Зураг URL" name="poster_url" type="url" defaultValue={episode?.poster_url ?? ""} />
        <Input label="Оршил эхлэх (сек)" name="intro_start_seconds" type="number" min={0} defaultValue={episode?.intro_start_seconds ?? ""} />
        <Input label="Оршил дуусах (сек)" name="intro_end_seconds" type="number" min={0} defaultValue={episode?.intro_end_seconds ?? ""} />
        <div className="space-y-1.5">
          <label htmlFor={`${idp}-status`} className="block text-sm text-mist-300">Төлөв</label>
          <select
            id={`${idp}-status`}
            name="status"
            defaultValue={
              episode && ["draft", "scheduled", "published"].includes(episode.status) ? episode.status : "draft"
            }
            className={selectCls}
          >
            <option value="draft">Ноорог</option>
            <option value="scheduled">Товлох</option>
            <option value="published">Нийтлэх</option>
          </select>
        </div>
      </div>
      <fieldset className="space-y-3 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
        <legend className="px-1 text-sm text-mist-300">Видео ассет (сонголтоор)</legend>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor={`${idp}-vp`} className="block text-sm text-mist-300">Провайдер</label>
            <select id={`${idp}-vp`} name="video_provider" defaultValue={asset?.provider ?? ""} className={selectCls}>
              <option value="">— Байхгүй —</option>
              <option value="bunny">bunny</option>
              <option value="cloudflare">cloudflare</option>
              <option value="aws">aws</option>
              <option value="mock">mock</option>
            </select>
          </div>
          <Input label="Провайдерын видео ID" name="video_provider_video_id" defaultValue={asset?.provider_video_id ?? ""} />
          <Input label="HLS зам" name="video_hls_path" defaultValue={asset?.hls_path ?? ""} placeholder="videos/abc/playlist.m3u8" />
        </div>
        <div className="flex flex-wrap gap-2">
          {QUALITIES.map((q) => (
            <label key={q} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs text-mist-300 has-[:checked]:border-royal-500/60 has-[:checked]:text-royal-300">
              <input
                type="checkbox"
                name="video_qualities"
                value={q}
                defaultChecked={asset ? asset.qualities.includes(q) : q === "720p" || q === "1080p"}
                className="sr-only"
              />
              {q}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
        <legend className="px-1 text-sm text-mist-300">Дуу оруулах (дубляж)</legend>
        <AudioTracksField languages={languages} initial={audioTracks} idPrefix={idp} />
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" size="sm">{episode ? "Хадгалах" : "Анги нэмэх"}</Button>
      </div>
    </form>
  );
}

export default async function ManageSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireRole("content_manager");
  const { id } = await params;
  const sp = await searchParams;
  const db = createAdminClient();

  const seriesRes = await db.from("series").select("*").eq("id", id).single();
  if (seriesRes.error || !seriesRes.data) notFound();
  const series = seriesRes.data as Series;

  const [genres, countries, languagesRes, sg, seasonsRes] = await Promise.all([
    db.from("genres").select("*").order("name_mn"),
    db.from("countries").select("*").order("name_mn"),
    db.from("languages").select("*").order("name_mn"),
    db.from("series_genres").select("genre_id").eq("series_id", id),
    db.from("seasons").select("*").eq("series_id", id).order("season_number"),
  ]);
  const languages = (languagesRes.data ?? []) as Language[];
  const seasons = (seasonsRes.data ?? []) as Season[];

  const seasonIds = seasons.map((s) => s.id);
  const episodesRes = seasonIds.length
    ? await db.from("episodes").select("*").in("season_id", seasonIds).order("episode_number")
    : { data: [] as Episode[] };
  const episodes = (episodesRes.data ?? []) as Episode[];

  const assetIds = episodes.map((e) => e.playback_asset_id).filter((x): x is string => Boolean(x));
  const assetsRes = assetIds.length
    ? await db.from("video_assets").select("*").in("id", assetIds)
    : { data: [] as VideoAsset[] };
  const assetById = new Map(((assetsRes.data ?? []) as VideoAsset[]).map((a) => [a.id, a]));

  type EpisodeAudioRow = {
    content_id: string;
    language_id: string;
    label: string;
    url: string | null;
    is_default: boolean;
  };
  const audioRes = episodes.length
    ? await db
        .from("audio_tracks")
        .select("content_id,language_id,label,url,is_default")
        .eq("content_type", "episode")
        .in("content_id", episodes.map((e) => e.id))
    : { data: [] as EpisodeAudioRow[] };
  const audioByEpisode = new Map<string, AudioTrackDraft[]>();
  for (const row of (audioRes.data ?? []) as EpisodeAudioRow[]) {
    const list = audioByEpisode.get(row.content_id) ?? [];
    list.push({
      language_id: row.language_id,
      label: row.label,
      url: row.url ?? "",
      is_default: row.is_default,
    });
    audioByEpisode.set(row.content_id, list);
  }

  const nextSeasonNumber = seasons.length ? Math.max(...seasons.map((s) => s.season_number)) + 1 : 1;

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      <Link href="/admin/series" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Цуврал руу буцах
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">{series.title_mn}</h1>
        <Badge tone={contentStatusTone[series.status]}>{contentStatusLabel[series.status]}</Badge>
      </div>

      <MessageBanner message={sp.message} error={sp.error} />

      <details className="group rounded-xl border border-ink-600 bg-ink-800" open={Boolean(sp.error)}>
        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-lg font-medium text-white">
          Цувралын мэдээлэл засах
          <ChevronDown className="h-5 w-5 text-mist-500 transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-ink-700 p-5">
          <form action={saveSeries} className="space-y-6">
            <SeriesFields
              series={series}
              genres={(genres.data ?? []) as Genre[]}
              countries={(countries.data ?? []) as Country[]}
              selectedGenreIds={((sg.data ?? []) as { genre_id: string }[]).map((r) => r.genre_id)}
            />
            <Button type="submit">Хадгалах</Button>
          </form>
        </div>
      </details>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium text-white">Бүлгүүд ({seasons.length})</h2>
        </div>

        <form action={addSeason} className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-600 bg-ink-800 p-4">
          <input type="hidden" name="series_id" value={series.id} />
          <Input label="Бүлгийн дугаар *" name="season_number" type="number" min={1} defaultValue={nextSeasonNumber} required />
          <Input label="Бүлгийн нэр" name="title" placeholder="Жнь: 1-р бүлэг" />
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" aria-hidden /> Бүлэг нэмэх
          </Button>
        </form>

        {seasons.length === 0 ? (
          <EmptyState title="Бүлэг алга" description="Дээрх маягтаар эхний бүлгээ нэмнэ үү." />
        ) : (
          seasons.map((season) => {
            const eps = episodes.filter((e) => e.season_id === season.id);
            const nextEp = eps.length ? Math.max(...eps.map((e) => e.episode_number)) + 1 : 1;
            return (
              <details key={season.id} className="group rounded-xl border border-ink-600 bg-ink-800">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4">
                  <span className="flex items-center gap-3">
                    <span className="font-medium text-white">
                      Бүлэг {season.season_number}
                      {season.title ? ` — ${season.title}` : ""}
                    </span>
                    <Badge>{eps.length} анги</Badge>
                  </span>
                  <ChevronDown className="h-5 w-5 text-mist-500 transition group-open:rotate-180" aria-hidden />
                </summary>
                <div className="space-y-4 border-t border-ink-700 p-5">
                  {eps.length === 0 ? (
                    <EmptyState title="Анги алга" description="Доорх маягтаар анги нэмнэ үү." />
                  ) : (
                    <div className="space-y-2">
                      {eps.map((ep) => (
                        <details key={ep.id} className="rounded-lg border border-ink-700 bg-ink-900/60">
                          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                            <span className="flex items-center gap-3">
                              <span className="font-mono text-xs text-royal-300">#{ep.episode_number}</span>
                              <span className="text-mist-100">{ep.title_mn}</span>
                              {ep.duration_seconds ? (
                                <span className="text-xs text-mist-500">{Math.round(ep.duration_seconds / 60)} мин</span>
                              ) : null}
                            </span>
                            <Badge tone={contentStatusTone[ep.status]}>{contentStatusLabel[ep.status]}</Badge>
                          </summary>
                          <div className="space-y-3 border-t border-ink-700 p-4">
                            <EpisodeForm
                              seriesId={series.id}
                              seasonId={season.id}
                              episode={ep}
                              asset={ep.playback_asset_id ? (assetById.get(ep.playback_asset_id) ?? null) : null}
                              nextNumber={ep.episode_number}
                              languages={languages}
                              audioTracks={audioByEpisode.get(ep.id) ?? []}
                            />
                            <form action={deleteEpisode}>
                              <input type="hidden" name="series_id" value={series.id} />
                              <input type="hidden" name="id" value={ep.id} />
                              <Button type="submit" variant="danger" size="sm">Анги устгах</Button>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}

                  <details className="rounded-lg border border-dashed border-ink-600 bg-ink-900/40">
                    <summary className="cursor-pointer px-4 py-3 text-sm text-royal-300">+ Шинэ анги нэмэх</summary>
                    <div className="border-t border-ink-700 p-4">
                      <EpisodeForm
                        seriesId={series.id}
                        seasonId={season.id}
                        episode={null}
                        asset={null}
                        nextNumber={nextEp}
                        languages={languages}
                        audioTracks={[]}
                      />
                    </div>
                  </details>

                  <form action={deleteSeason}>
                    <input type="hidden" name="series_id" value={series.id} />
                    <input type="hidden" name="id" value={season.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-red-400">
                      Бүлэг устгах
                    </Button>
                  </form>
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className="rounded-xl border border-red-900/40 bg-red-950/20 p-5">
        <h2 className="mb-2 text-lg font-medium text-red-300">Аюултай бүс</h2>
        <p className="mb-3 text-sm text-mist-400">Цувралыг зөөлөн устгана (deleted_at тавигдана, сэргээх боломжтой).</p>
        <form action={softDeleteSeries}>
          <input type="hidden" name="id" value={series.id} />
          <Button type="submit" variant="danger" size="sm">Цуврал устгах</Button>
        </form>
      </section>
    </div>
  );
}
