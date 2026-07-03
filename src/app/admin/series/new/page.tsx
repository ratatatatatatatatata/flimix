import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SeriesFields } from "../SeriesFields";
import { saveSeries } from "../actions";
import { MessageBanner } from "../../_components/MessageBanner";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Country, Genre } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function NewSeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("content_manager");
  const sp = await searchParams;
  const db = createAdminClient();
  const [genres, countries] = await Promise.all([
    db.from("genres").select("*").order("name_mn"),
    db.from("countries").select("*").order("name_mn"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <Link href="/admin/series" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Цуврал руу буцах
      </Link>
      <h1 className="text-2xl font-semibold text-white">Шинэ цуврал</h1>
      <MessageBanner error={sp.error} />
      <form action={saveSeries} className="space-y-6 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <SeriesFields
          series={null}
          genres={(genres.data ?? []) as Genre[]}
          countries={(countries.data ?? []) as Country[]}
          selectedGenreIds={[]}
        />
        <Button type="submit">Цуврал үүсгэх</Button>
      </form>
    </div>
  );
}
