import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBanner } from "../_components/MessageBanner";
import { Pagination } from "../_components/Pagination";
import { contentStatusLabel, contentStatusTone, fmtDate } from "../_lib/format";
import { togglePublishMovie, archiveMovie, softDeleteMovie } from "./actions";
import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import type { ContentStatus, Movie } from "@/types/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const STATUS_CHIPS: (ContentStatus | "all")[] = [
  "all",
  "draft",
  "scheduled",
  "published",
  "unpublished",
  "archived",
];

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
  message?: string;
  error?: string;
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole("content_manager");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = STATUS_CHIPS.includes((sp.status ?? "") as ContentStatus)
    ? ((sp.status ?? "all") as ContentStatus | "all")
    : "all";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const db = createAdminClient();
  let query = db
    .from("movies")
    .select("id,slug,title_mn,title_en,release_year,status,poster_url,published_at,updated_at", {
      count: "exact",
    })
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    query = query.or(`title_mn.ilike.${like},title_en.ilike.${like},original_title.ilike.${like}`);
  }
  if (status !== "all") query = query.eq("status", status);

  const { data, count } = await query;
  const movies = (data ?? []) as Pick<
    Movie,
    "id" | "slug" | "title_mn" | "title_en" | "release_year" | "status" | "poster_url" | "published_at" | "updated_at"
  >[];

  const listParams: Record<string, string> = {};
  if (q) listParams.q = q;
  if (status !== "all") listParams.status = status;
  const currentReturn = `/admin/content?${new URLSearchParams({ ...listParams, page: String(page) }).toString()}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Контент — Кино</h1>
        <div className="flex gap-2">
          <Link href="/admin/content/import">
            <Button variant="secondary" size="sm">
              <Upload className="h-4 w-4" aria-hidden /> CSV импорт
            </Button>
          </Link>
          <Link href="/admin/content/new">
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden /> Шинэ кино
            </Button>
          </Link>
        </div>
      </div>

      <MessageBanner message={sp.message} error={sp.error} />

      <form method="GET" className="flex flex-wrap items-center gap-3" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Киноны нэрээр хайх..."
            aria-label="Киноны нэрээр хайх"
            className="w-full rounded-lg border border-ink-600 bg-ink-800 py-2 pl-9 pr-4 text-sm text-mist-100 placeholder:text-mist-500 focus:border-royal-500"
          />
        </div>
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <Button type="submit" variant="secondary" size="sm">
          Хайх
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => {
          const spNew = new URLSearchParams(q ? { q } : {});
          if (chip !== "all") spNew.set("status", chip);
          const active = status === chip;
          return (
            <Link
              key={chip}
              href={`/admin/content?${spNew.toString()}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-royal-500/60 bg-royal-700/30 text-royal-300"
                  : "border-ink-600 bg-ink-800 text-mist-400 hover:text-white"
              }`}
            >
              {chip === "all" ? "Бүгд" : contentStatusLabel[chip]}
            </Link>
          );
        })}
      </div>

      {movies.length === 0 ? (
        <EmptyState
          title="Кино олдсонгүй"
          description={q ? `"${q}" хайлтад тохирох кино алга.` : "Одоогоор бүртгэлтэй кино алга."}
          action={
            <Link href="/admin/content/new">
              <Button size="sm">Шинэ кино нэмэх</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-600">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-mist-500">
              <tr>
                <th className="px-4 py-3">Постер</th>
                <th className="px-4 py-3">Нэр</th>
                <th className="px-4 py-3">Он</th>
                <th className="px-4 py-3">Төлөв</th>
                <th className="px-4 py-3">Нийтэлсэн</th>
                <th className="px-4 py-3">Шинэчилсэн</th>
                <th className="px-4 py-3 text-right">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-800/60">
              {movies.map((m) => (
                <tr key={m.id} className="hover:bg-ink-800">
                  <td className="px-4 py-2">
                    {m.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.poster_url}
                        alt=""
                        className="h-14 w-10 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-14 w-10 items-center justify-center rounded bg-ink-700 text-xs text-mist-500">
                        —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-mist-100">{m.title_mn}</p>
                    {m.title_en ? <p className="text-xs text-mist-500">{m.title_en}</p> : null}
                  </td>
                  <td className="px-4 py-2 text-mist-300">{m.release_year ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Badge tone={contentStatusTone[m.status]}>{contentStatusLabel[m.status]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-mist-400">{fmtDate(m.published_at)}</td>
                  <td className="px-4 py-2 text-mist-400">{fmtDate(m.updated_at)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/admin/content/${m.id}/edit`}
                        className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 hover:border-royal-500/60 hover:text-white"
                      >
                        Засах
                      </Link>
                      <form action={togglePublishMovie}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="return" value={currentReturn} />
                        <button
                          type="submit"
                          className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 hover:border-royal-500/60 hover:text-white"
                        >
                          {m.status === "published" ? "Болиулах" : "Нийтлэх"}
                        </button>
                      </form>
                      <form action={archiveMovie}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="return" value={currentReturn} />
                        <button
                          type="submit"
                          className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 hover:border-amber-500/60 hover:text-amber-300"
                        >
                          Архивлах
                        </button>
                      </form>
                      <form action={softDeleteMovie}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="return" value={currentReturn} />
                        <button
                          type="submit"
                          className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-red-400 hover:border-red-500/60 hover:text-red-300"
                        >
                          Устгах
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/content"
        params={listParams}
      />
    </div>
  );
}
