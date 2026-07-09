import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MovieForm } from "../MovieForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { CastMember, Country, CrewMember, Genre, Language } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function NewMoviePage() {
  await requireRole("content_manager");
  const db = createAdminClient();

  const [genres, countries, languages, cast, crew] = await Promise.all([
    db.from("genres").select("*").order("name_mn"),
    db.from("countries").select("*").order("name_mn"),
    db.from("languages").select("*").order("name_mn"),
    db.from("cast_members").select("*").order("name"),
    db.from("crew_members").select("*").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <Link href="/admin/content" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Контент руу буцах
      </Link>
      <h1 className="text-2xl font-semibold text-white">Шинэ кино</h1>
      <MovieForm
        movie={null}
        genres={(genres.data ?? []) as Genre[]}
        countries={(countries.data ?? []) as Country[]}
        languages={(languages.data ?? []) as Language[]}
        castMembers={(cast.data ?? []) as CastMember[]}
        crewMembers={(crew.data ?? []) as CrewMember[]}
        selectedGenreIds={[]}
        selectedCastIds={[]}
        selectedCrewIds={[]}
        subtitles={[]}
        audioTracks={[]}
        videoAsset={null}
      />
    </div>
  );
}
