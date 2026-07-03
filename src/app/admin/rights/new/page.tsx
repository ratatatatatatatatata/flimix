import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { RightFields, type ContentOption } from "../RightFields";
import { saveRight } from "../actions";
import { MessageBanner } from "../../_components/MessageBanner";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ContentPartner } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function NewRightPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const db = createAdminClient();

  const [movies, series, partners] = await Promise.all([
    db.from("movies").select("id,title_mn").is("deleted_at", null).order("title_mn").limit(500),
    db.from("series").select("id,title_mn").is("deleted_at", null).order("title_mn").limit(500),
    db.from("content_partners").select("*").order("name"),
  ]);

  const contentOptions: ContentOption[] = [
    ...((movies.data ?? []) as { id: string; title_mn: string }[]).map((m) => ({
      value: `movie:${m.id}`,
      label: `Кино — ${m.title_mn}`,
    })),
    ...((series.data ?? []) as { id: string; title_mn: string }[]).map((s) => ({
      value: `series:${s.id}`,
      label: `Цуврал — ${s.title_mn}`,
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Link href="/admin/rights" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Эрхийн жагсаалт руу буцах
      </Link>
      <h1 className="text-2xl font-semibold text-white">Шинэ контентын эрх</h1>
      <MessageBanner error={sp.error} />
      <form action={saveRight} className="space-y-6 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <RightFields right={null} partners={(partners.data ?? []) as ContentPartner[]} contentOptions={contentOptions} />
        <Button type="submit">Эрх бүртгэх</Button>
        <p className="text-xs text-mist-500">Шинэ эрх “Хүлээгдэж буй” төлөвтэй үүсэх бөгөөд баталгаажсаны дараа контент нийтлэх боломжтой болно.</p>
      </form>
    </div>
  );
}
