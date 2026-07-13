"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  runAdminAction,
  must,
  AdminActionError,
  type AdminDb,
} from "../_lib/adminAction";
import { RIGHTS_BLOCK_MESSAGE, contentRightsRequired } from "../_lib/messages";

const optional = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

function withParam(path: string, key: "message" | "error", value: string): string {
  const [base, qs] = path.split("?");
  const sp = new URLSearchParams(qs ?? "");
  sp.delete("message");
  sp.delete("error");
  sp.set(key, value);
  return `${base}?${sp.toString()}`;
}

async function hasApprovedActiveSeriesRight(db: AdminDb, seriesId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("content_rights")
    .select("id")
    .eq("content_type", "series")
    .eq("content_id", seriesId)
    .eq("approval_status", "approved")
    .lte("rights_start", nowIso)
    .gt("rights_end", nowIso)
    .limit(1);
  return (data ?? []).length > 0;
}

/* ------------------------------------------------------------------ */
/* Series create / update                                              */
/* ------------------------------------------------------------------ */

const seriesSchema = z.object({
  id: z.string().uuid().optional(),
  title_mn: z.string().min(1, "Монгол нэр шаардлагатай"),
  title_en: z.string().nullable(),
  original_title: z.string().nullable(),
  slug: z
    .string()
    .min(1, "Slug шаардлагатай")
    .regex(/^[a-z0-9-]+$/, "Slug зөвхөн латин жижиг үсэг, тоо, зураас"),
  description_mn: z.string().nullable(),
  description_en: z.string().nullable(),
  release_year: z.coerce.number().int().min(1900).max(2100).nullable(),
  age_rating: z.enum(["G", "PG", "PG-13", "R", "NC-17"]).nullable(),
  country_id: z.string().uuid().nullable(),
  poster_url: z.string().url("Постерын URL буруу").nullable(),
  backdrop_url: z.string().url("Арын зургийн URL буруу").nullable(),
  trailer_url: z.string().url("Трейлерийн URL буруу").nullable(),
  status: z.enum(["draft", "scheduled", "published"]),
  published_at: z.string().nullable(),
  genre_ids: z.array(z.string().uuid()),
});

export async function saveSeries(formData: FormData): Promise<void> {
  const result = await runAdminAction<{ id: string }>(
    "content_manager",
    "series.save",
    "series",
    async ({ db }) => {
      const input = seriesSchema.parse({
        id: optional(formData.get("id")) ?? undefined,
        title_mn: String(formData.get("title_mn") ?? ""),
        title_en: optional(formData.get("title_en")),
        original_title: optional(formData.get("original_title")),
        slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
        description_mn: optional(formData.get("description_mn")),
        description_en: optional(formData.get("description_en")),
        release_year: optional(formData.get("release_year")),
        age_rating: optional(formData.get("age_rating")),
        country_id: optional(formData.get("country_id")),
        poster_url: optional(formData.get("poster_url")),
        backdrop_url: optional(formData.get("backdrop_url")),
        trailer_url: optional(formData.get("trailer_url")),
        status: String(formData.get("status") ?? "draft"),
        published_at: optional(formData.get("published_at")),
        genre_ids: formData.getAll("genre_ids").map(String),
      });

      if (input.status === "published" && contentRightsRequired()) {
        if (!input.id || !(await hasApprovedActiveSeriesRight(db, input.id))) {
          throw new AdminActionError(RIGHTS_BLOCK_MESSAGE);
        }
      }
      if (input.status === "scheduled" && !input.published_at) {
        throw new AdminActionError("Товлох огноог оруулна уу.");
      }

      const row = {
        slug: input.slug,
        title_mn: input.title_mn,
        title_en: input.title_en,
        original_title: input.original_title,
        description_mn: input.description_mn,
        description_en: input.description_en,
        release_year: input.release_year,
        age_rating: input.age_rating,
        country_id: input.country_id,
        poster_url: input.poster_url,
        backdrop_url: input.backdrop_url,
        trailer_url: input.trailer_url,
        status: input.status,
        published_at:
          input.status === "published"
            ? (input.published_at ?? new Date().toISOString())
            : input.status === "scheduled"
              ? input.published_at
              : null,
        updated_at: new Date().toISOString(),
      };

      let seriesId: string;
      if (input.id) {
        must(
          await db.from("series").update(row).eq("id", input.id).select("id").single(),
          "Цуврал шинэчлэхэд алдаа",
        );
        seriesId = input.id;
      } else {
        const inserted = must(
          await db.from("series").insert(row).select("id").single(),
          "Цуврал үүсгэхэд алдаа",
        ) as { id: string };
        seriesId = inserted.id;
      }

      await db.from("series_genres").delete().eq("series_id", seriesId);
      if (input.genre_ids.length) {
        must(
          await db
            .from("series_genres")
            .insert(input.genre_ids.map((genre_id) => ({ series_id: seriesId, genre_id })))
            .select("series_id"),
          "Төрөл хадгалахад алдаа",
        );
      }

      return {
        data: { id: seriesId },
        entityId: seriesId,
        details: { slug: input.slug, status: input.status, created: !input.id },
      };
    },
  );

  revalidatePath("/admin/series");
  revalidatePath("/");
  if (result.ok) {
    redirect(withParam(`/admin/series/${result.data.id}`, "message", "Цуврал хадгалагдлаа."));
  }
  const id = optional(formData.get("id"));
  redirect(withParam(id ? `/admin/series/${id}` : "/admin/series/new", "error", result.error));
}

export async function softDeleteSeries(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "content_manager",
    "series.soft_delete",
    "series",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      must(
        await db
          .from("series")
          .update({ deleted_at: new Date().toISOString(), status: "archived", updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .single(),
        "Устгахад алдаа",
      );
      return { data: null, entityId: id };
    },
  );
  revalidatePath("/admin/series");
  redirect(
    result.ok
      ? withParam("/admin/series", "message", "Цуврал устгагдлаа (сэргээх боломжтой).")
      : withParam("/admin/series", "error", result.error),
  );
}

/* ------------------------------------------------------------------ */
/* Seasons                                                             */
/* ------------------------------------------------------------------ */

export async function addSeason(formData: FormData): Promise<void> {
  const seriesId = z.string().uuid().parse(formData.get("series_id"));
  const result = await runAdminAction<null>(
    "content_manager",
    "season.create",
    "season",
    async ({ db }) => {
      const seasonNumber = z.coerce.number().int().min(1).max(200).parse(formData.get("season_number"));
      const title = optional(formData.get("title"));
      const created = must(
        await db
          .from("seasons")
          .insert({ series_id: seriesId, season_number: seasonNumber, title })
          .select("id")
          .single(),
        "Бүлэг нэмэхэд алдаа",
      ) as { id: string };
      return { data: null, entityId: created.id, details: { series_id: seriesId, season_number: seasonNumber } };
    },
  );
  revalidatePath(`/admin/series/${seriesId}`);
  redirect(
    result.ok
      ? withParam(`/admin/series/${seriesId}`, "message", "Бүлэг нэмэгдлээ.")
      : withParam(`/admin/series/${seriesId}`, "error", result.error),
  );
}

export async function deleteSeason(formData: FormData): Promise<void> {
  const seriesId = z.string().uuid().parse(formData.get("series_id"));
  const result = await runAdminAction<null>(
    "content_manager",
    "season.delete",
    "season",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      const { count } = await db
        .from("episodes")
        .select("id", { count: "exact", head: true })
        .eq("season_id", id);
      if ((count ?? 0) > 0) {
        throw new AdminActionError("Ангитай бүлгийг устгах боломжгүй. Эхлээд ангиудыг устгана уу.");
      }
      must(await db.from("seasons").delete().eq("id", id).select("id").single(), "Бүлэг устгахад алдаа");
      return { data: null, entityId: id, details: { series_id: seriesId } };
    },
  );
  revalidatePath(`/admin/series/${seriesId}`);
  redirect(
    result.ok
      ? withParam(`/admin/series/${seriesId}`, "message", "Бүлэг устгагдлаа.")
      : withParam(`/admin/series/${seriesId}`, "error", result.error),
  );
}

/* ------------------------------------------------------------------ */
/* Episodes                                                            */
/* ------------------------------------------------------------------ */

const audioTrackSchema = z.object({
  language_id: z.string().uuid(),
  label: z.string().transform((v) => v.trim() || "Дубляж"),
  url: z.string().url("Дууны URL буруу байна"),
  is_default: z.boolean(),
});

const parseJsonField = (formData: FormData, name: string): unknown => {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AdminActionError(`Талбарын өгөгдөл эвдэрсэн байна (${name})`);
  }
};

const episodeSchema = z.object({
  id: z.string().uuid().optional(),
  season_id: z.string().uuid(),
  episode_number: z.coerce.number().int().min(1).max(2000),
  title_mn: z.string().min(1, "Ангийн нэр шаардлагатай"),
  title_en: z.string().nullable(),
  description_mn: z.string().nullable(),
  duration_minutes: z.coerce.number().int().min(0).max(6000).nullable(),
  poster_url: z.string().url("Зургийн URL буруу").nullable(),
  intro_start_seconds: z.coerce.number().int().min(0).nullable(),
  intro_end_seconds: z.coerce.number().int().min(0).nullable(),
  status: z.enum(["draft", "scheduled", "published"]),
  video_provider: z.enum(["bunny", "cloudflare", "aws", "mock", "r2"]).nullable(),
  video_provider_video_id: z.string().nullable(),
  video_hls_path: z.string().nullable(),
  video_qualities: z.array(z.string()),
  audio_tracks: z.array(audioTrackSchema),
});

export async function saveEpisode(formData: FormData): Promise<void> {
  const seriesId = z.string().uuid().parse(formData.get("series_id"));
  const result = await runAdminAction<null>(
    "content_manager",
    "episode.save",
    "episode",
    async ({ db }) => {
      const input = episodeSchema.parse({
        id: optional(formData.get("id")) ?? undefined,
        season_id: formData.get("season_id"),
        episode_number: formData.get("episode_number"),
        title_mn: String(formData.get("title_mn") ?? ""),
        title_en: optional(formData.get("title_en")),
        description_mn: optional(formData.get("description_mn")),
        duration_minutes: optional(formData.get("duration_minutes")),
        poster_url: optional(formData.get("poster_url")),
        intro_start_seconds: optional(formData.get("intro_start_seconds")),
        intro_end_seconds: optional(formData.get("intro_end_seconds")),
        status: String(formData.get("status") ?? "draft"),
        video_provider: optional(formData.get("video_provider")),
        video_provider_video_id: optional(formData.get("video_provider_video_id")),
        video_hls_path: optional(formData.get("video_hls_path")),
        video_qualities: formData.getAll("video_qualities").map(String),
        audio_tracks: (parseJsonField(formData, "audio_tracks_json") ?? []) as unknown,
      });

      if (
        input.intro_start_seconds !== null &&
        input.intro_end_seconds !== null &&
        input.intro_end_seconds <= input.intro_start_seconds
      ) {
        throw new AdminActionError("Оршил дуусах секунд эхлэхээс их байх ёстой.");
      }

      const durationSeconds = input.duration_minutes === null ? null : input.duration_minutes * 60;
      const row = {
        season_id: input.season_id,
        episode_number: input.episode_number,
        title_mn: input.title_mn,
        title_en: input.title_en,
        description_mn: input.description_mn,
        duration_seconds: durationSeconds,
        poster_url: input.poster_url,
        intro_start_seconds: input.intro_start_seconds,
        intro_end_seconds: input.intro_end_seconds,
        status: input.status,
        published_at: input.status === "published" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      let episodeId: string;
      if (input.id) {
        must(
          await db.from("episodes").update(row).eq("id", input.id).select("id").single(),
          "Анги шинэчлэхэд алдаа",
        );
        episodeId = input.id;
      } else {
        const created = must(
          await db.from("episodes").insert(row).select("id").single(),
          "Анги нэмэхэд алдаа",
        ) as { id: string };
        episodeId = created.id;
      }

      // Optional video asset link.
      if (input.video_provider && input.video_provider_video_id && input.video_hls_path) {
        if (input.video_qualities.length === 0) {
          throw new AdminActionError("Видеоны дор хаяж нэг чанар сонгоно уу.");
        }
        const assetRow = {
          provider: input.video_provider,
          provider_video_id: input.video_provider_video_id,
          hls_path: input.video_hls_path,
          qualities: input.video_qualities,
          duration_seconds: durationSeconds,
          status: "ready" as const,
        };
        const { data: existing } = await db
          .from("episodes")
          .select("playback_asset_id")
          .eq("id", episodeId)
          .single();
        const existingAssetId = (existing as { playback_asset_id: string | null } | null)
          ?.playback_asset_id;
        if (existingAssetId) {
          must(
            await db.from("video_assets").update(assetRow).eq("id", existingAssetId).select("id").single(),
            "Видео ассет шинэчлэхэд алдаа",
          );
        } else {
          const asset = must(
            await db.from("video_assets").insert(assetRow).select("id").single(),
            "Видео ассет үүсгэхэд алдаа",
          ) as { id: string };
          must(
            await db
              .from("episodes")
              .update({ playback_asset_id: asset.id })
              .eq("id", episodeId)
              .select("id")
              .single(),
            "Видео ассет холбоход алдаа",
          );
        }
      }

      // Sync dub audio tracks (replace-all, mirrors movie subtitles/audio).
      await db
        .from("audio_tracks")
        .delete()
        .eq("content_type", "episode")
        .eq("content_id", episodeId);
      if (input.audio_tracks.length) {
        must(
          await db
            .from("audio_tracks")
            .insert(
              input.audio_tracks.map((a) => ({
                content_type: "episode",
                content_id: episodeId,
                language_id: a.language_id,
                label: a.label,
                url: a.url,
                is_default: a.is_default,
              })),
            )
            .select("id"),
          "Дубляжийн дуу хадгалахад алдаа",
        );
      }

      return {
        data: null,
        entityId: episodeId,
        details: { season_id: input.season_id, episode_number: input.episode_number, created: !input.id },
      };
    },
  );
  revalidatePath(`/admin/series/${seriesId}`);
  redirect(
    result.ok
      ? withParam(`/admin/series/${seriesId}`, "message", "Анги хадгалагдлаа.")
      : withParam(`/admin/series/${seriesId}`, "error", result.error),
  );
}

export async function deleteEpisode(formData: FormData): Promise<void> {
  const seriesId = z.string().uuid().parse(formData.get("series_id"));
  const result = await runAdminAction<null>(
    "content_manager",
    "episode.delete",
    "episode",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      must(await db.from("episodes").delete().eq("id", id).select("id").single(), "Анги устгахад алдаа");
      return { data: null, entityId: id, details: { series_id: seriesId } };
    },
  );
  revalidatePath(`/admin/series/${seriesId}`);
  redirect(
    result.ok
      ? withParam(`/admin/series/${seriesId}`, "message", "Анги устгагдлаа.")
      : withParam(`/admin/series/${seriesId}`, "error", result.error),
  );
}
