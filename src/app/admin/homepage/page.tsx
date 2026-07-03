import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveSection, deleteSection } from "./actions";
import { MessageBanner } from "../_components/MessageBanner";
import { fmtDateTime } from "../_lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ArrowDown, ArrowUp, Eye, Plus } from "lucide-react";
import type { HomepageSection } from "@/types/db";

export const dynamic = "force-dynamic";

const LAYOUT_LABEL: Record<HomepageSection["layout"], string> = {
  hero: "Hero",
  row: "Мөр",
  grid: "Тор",
  banner: "Баннер",
};

export default async function HomepageSectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireRole("content_manager");
  const sp = await searchParams;
  const db = createAdminClient();

  const { data } = await db.from("homepage_sections").select("*").order("sort_order");
  const sections = (data ?? []) as HomepageSection[];

  const itemCounts = new Map<string, number>();
  if (sections.length) {
    const { data: items } = await db
      .from("homepage_section_items")
      .select("section_id")
      .in("section_id", sections.map((s) => s.id));
    for (const it of (items ?? []) as { section_id: string }[]) {
      itemCounts.set(it.section_id, (itemCounts.get(it.section_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Нүүр хуудасны хэсгүүд</h1>
        <Link href="/admin/homepage/new">
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden /> Шинэ хэсэг
          </Button>
        </Link>
      </div>

      <MessageBanner message={sp.message} error={sp.error} />

      {sections.length === 0 ? (
        <EmptyState
          title="Хэсэг алга"
          description="Нүүр хуудсанд харагдах эхний хэсгээ үүсгэнэ үү."
          action={
            <Link href="/admin/homepage/new">
              <Button size="sm">Шинэ хэсэг үүсгэх</Button>
            </Link>
          }
        />
      ) : (
        <ol className="space-y-2">
          {sections.map((s, i) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-mono text-sm text-mist-500">{i + 1}</span>
                <div>
                  <p className="font-medium text-white">{s.title_mn}</p>
                  <p className="text-xs text-mist-500">
                    {s.slug} · {LAYOUT_LABEL[s.layout]} ·{" "}
                    {s.query_type === "manual" ? `гараар (${itemCounts.get(s.id) ?? 0} контент)` : "автомат"}
                    {s.visible_from || s.visible_until
                      ? ` · ${fmtDateTime(s.visible_from)} → ${fmtDateTime(s.visible_until)}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={s.status === "published" ? "success" : "default"}>
                  {s.status === "published" ? "Нийтлэгдсэн" : "Ноорог"}
                </Badge>
                <form action={moveSection}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label="Дээш зөөх"
                    className="rounded-md border border-ink-600 p-1.5 text-mist-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </form>
                <form action={moveSection}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button
                    type="submit"
                    disabled={i === sections.length - 1}
                    aria-label="Доош зөөх"
                    className="rounded-md border border-ink-600 p-1.5 text-mist-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </form>
                <Link
                  href={`/admin/homepage/${s.id}/preview`}
                  aria-label="Урьдчилан харах"
                  className="rounded-md border border-ink-600 p-1.5 text-mist-400 hover:text-white"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                </Link>
                <Link
                  href={`/admin/homepage/${s.id}`}
                  className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 hover:border-royal-500/60 hover:text-white"
                >
                  Засах
                </Link>
                <form action={deleteSection}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-red-400 hover:border-red-500/60">
                    Устгах
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
