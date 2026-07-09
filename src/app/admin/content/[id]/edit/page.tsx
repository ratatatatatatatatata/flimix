import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { MovieForm, type SubtitleDraft } from "../../MovieForm";
import type { AudioTrackDraft } from "../../../_components/AudioTracksField";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  CastMember,
  Country,
  CrewMember,
  Genre,
  Language,
  Movie,
  VideoAsset,
} from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditMoviePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("content_manager");
  const { id } = await params;
  const db = createAdminClient();

  const movieRes = await db.from("movies").select("*").eq("id", id).single();
  if (movieRes.error || !movieRes.data) notFound();
  const movie = movieRes.data as Movie;

  const [genres, countries, languages, cast, crew, mg, mc, mcr, subs, audio, assetRes] =
    await Promise.all([
      db.from("genres").select("*").order("name_mn"),
      db.from("countries").select("*").order("name_mn"),
      db.from("languages").select("*").order("name_mn"),
      db.from("cast_members").select("*").order("name"),
      db.from("crew_members").select("*").order("name"),
      db.from("movie_genres").select("genre_id").eq("movie_id", id),
      db.from("movie_cast").select("cast_member_id").eq("movie_id", id),
      db.from("movie_crew").select("crew_member_id").eq("movie_id", id),
      db
        .from("subtitle_tracks")
        .select("language_id,label,url,is_default")
        .eq("content_type", "movie")
        .eq("content_id", id),
      db
        .from("audio_tracks")
        .select("language_id,label,url,is_default")
        .eq("content_type", "movie")
        .eq("content_id", id),
      movie.playback_asset_id
        ? db.from("video_assets").select("*").eq("id", movie.playback_asset_id).single()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <Link href="/admin/content" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Контент руу буцах
      </Link>
      <h1 className="text-2xl font-semibold text-white">Кино засах — {movie.title_mn}</h1>
      <MovieForm
        movie={movie}
        genres={(genres.data ?? []) as Genre[]}
        countries={(countries.data ?? []) as Country[]}
        languages={(languages.data ?? []) as Language[]}
        castMembers={(cast.data ?? []) as CastMember[]}
        crewMembers={(crew.data ?? []) as CrewMember[]}
        selectedGenreIds={((mg.data ?? []) as { genre_id: string }[]).map((r) => r.genre_id)}
        selectedCastIds={((mc.data ?? []) as { cast_member_id: string }[]).map((r) => r.cast_member_id)}
        selectedCrewIds={((mcr.data ?? []) as { crew_member_id: string }[]).map((r) => r.crew_member_id)}
        subtitles={(subs.data ?? []) as SubtitleDraft[]}
        audioTracks={(
          (audio.data ?? []) as {
            language_id: string;
            label: string;
            url: string | null;
            is_default: boolean;
          }[]
        ).map(
          (r): AudioTrackDraft => ({
            language_id: r.language_id,
            label: r.label,
            url: r.url ?? "",
            is_default: r.is_default,
          }),
        )}
        videoAsset={(assetRes.data as VideoAsset | null) ?? null}
      />
    </div>
  );
}
