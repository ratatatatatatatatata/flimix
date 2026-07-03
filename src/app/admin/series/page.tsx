import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBanner } from "../_components/MessageBanner";
import { Pagination } from "../_components/Pagination";
import { contentStatusLabel, contentStatusTone, fmtDate } from "../_lib/format";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { Series } from "@/types/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminSeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; message?: string; error?: string }>;
}) {
  await requireRole("content_manager");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const db = createAdminClient();
  let query = db
    .from("series")
    .select("id,slug,title_mn,title_en,release_year,status,poster_url,updated_at", { count: "exact" })
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    query = query.or(`title_mn.ilike.${like},title_en.ilike.${like}`);
  }
  const { data, count } = await query;
  const list = (data ?? []) as Pick<
    Series,
    "id" | "slug" | "title_mn" | "title_en" | "release_year" | "status" | "poster_url" | "updated_at"
  >[];

  // Season counts per series.
  const ids = list.map((s) => s.id);
  const seasonCounts = new Map<string, number>();
  if (ids.length) {
    const { data: seasonRows } = await db.from("seasons").select("series_id").in("series_id", ids);
    for (const r of (seasonRows ?? []) as { series_id: string }[]) {
      seasonCounts.set(r.series_id, (seasonCounts.get(r.series_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Цуврал</h1>
        <Link href="/admin/series/new">
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden /> Шинэ цуврал
          </Button>
        </Link>
      </div>

      <MessageBanner message={sp.message} error={sp.error} />

      <form method="GET" className="flex flex-wrap items-center gap-3" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Цувралын нэрээр хайх..."
            aria-label="Цувралын нэрээр хайх"
            className="w-full rounded-lg border border-ink-600 bg-ink-800 py-2 pl-9 pr-4 text-sm text-mist-100 placeholder:text-mist-500 focus:border-royal-500"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">Хайх</Button>
      </form>

      {list.length === 0 ? (
        <EmptyState
          title="Цуврал олдсонгүй"
          description={q ? `"${q}" хайлтад тохирох цуврал алга.` : "Одоогоор бүртгэлтэй цуврал алга."}
          action={
            <Link href="/admin/series/new">
              <Button size="sm">Шинэ цуврал нэмэх</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-600">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-mist-500">
              <tr>
                <th className="px-4 py-3">Постер</th>
                <th className="px-4 py-3">Нэр</th>
                <th className="px-4 py-3">Он</th>
                <th className="px-4 py-3">Бүлэг</th>
                <th className="px-4 py-3">Төлөв</th>
                <th className="px-4 py-3">Шинэчилсэн</th>
                <th className="px-4 py-3 text-right">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-800/60">
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-ink-800">
                  <td className="px-4 py-2">
                    {s.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.poster_url} alt="" className="h-14 w-10 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-14 w-10 items-center justify-center rounded bg-ink-700 text-xs text-mist-500">—</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-mist-100">{s.title_mn}</p>
                    {s.title_en ? <p className="text-xs text-mist-500">{s.title_en}</p> : null}
                  </td>
                  <td className="px-4 py-2 text-mist-300">{s.release_year ?? "—"}</td>
                  <td className="px-4 py-2 text-mist-300">{seasonCounts.get(s.id) ?? 0}</td>
                  <td className="px-4 py-2">
                    <Badge tone={contentStatusTone[s.status]}>{contentStatusLabel[s.status]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-mist-400">{fmtDate(s.updated_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/series/${s.id}`}
                      className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 hover:border-royal-500/60 hover:text-white"
                    >
                      Удирдах
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/admin/series" params={q ? { q } : {}} />
    </div>
  );
}
