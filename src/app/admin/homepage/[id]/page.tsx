import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { SectionFields } from "../SectionFields";
import { saveSection, addSectionItem, addSectionItemsBulk, removeSectionItem, moveSectionItem } from "../actions";
import { MessageBanner } from "../../_components/MessageBanner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, Search } from "lucide-react";
import type { HomepageSection, HomepageSectionItem } from "@/types/db";

export const dynamic = "force-dynamic";

interface TitleRow {
  id: string;
  title_mn: string;
  poster_url: string | null;
}

export default async function EditSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ itemQ?: string; message?: string; error?: string }>;
}) {
  await requireRole("content_manager");
  const { id } = await params;
  const sp = await searchParams;
  const itemQ = (sp.itemQ ?? "").trim();
  const db = createAdminClient();

  const sectionRes = await db.from("homepage_sections").select("*").eq("id", id).single();
  if (sectionRes.error || !sectionRes.data) notFound();
  const section = sectionRes.data as HomepageSection;

  const { data: itemsData } = await db
    .from("homepage_section_items")
    .select("*")
    .eq("section_id", id)
    .order("sort_order");
  const items = (itemsData ?? []) as HomepageSectionItem[];

  // Resolve item titles.
  const movieIds = items.filter((i) => i.content_type === "movie").map((i) => i.content_id);
  const seriesIds = items.filter((i) => i.content_type === "series").map((i) => i.content_id);
  const [itemMovies, itemSeries] = await Promise.all([
    movieIds.length
      ? db.from("movies").select("id,title_mn,poster_url").in("id", movieIds)
      : Promise.resolve({ data: [] as TitleRow[] }),
    seriesIds.length
      ? db.from("series").select("id,title_mn,poster_url").in("id", seriesIds)
      : Promise.resolve({ data: [] as TitleRow[] }),
  ]);
  const titleMap = new Map<string, TitleRow>();
  for (const m of (itemMovies.data ?? []) as TitleRow[]) titleMap.set(`movie:${m.id}`, m);
  for (const s of (itemSeries.data ?? []) as TitleRow[]) titleMap.set(`series:${s.id}`, s);

  // Full catalog checklist (published, not yet in the section).
  const existingKeys = new Set(items.map((i) => `${i.content_type}:${i.content_id}`));
  const [allMoviesRes, allSeriesRes] = await Promise.all([
    db
      .from("movies")
      .select("id,title_mn")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("title_mn")
      .limit(300),
    db
      .from("series")
      .select("id,title_mn")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("title_mn")
      .limit(300),
  ]);
  const pickerOptions = [
    ...((allMoviesRes.data ?? []) as { id: string; title_mn: string }[]).map((m) => ({
      value: `movie:${m.id}`,
      label: m.title_mn,
      kind: "Кино",
    })),
    ...((allSeriesRes.data ?? []) as { id: string; title_mn: string }[]).map((s) => ({
      value: `series:${s.id}`,
      label: s.title_mn,
      kind: "Цуврал",
    })),
  ].filter((o) => !existingKeys.has(o.value));

  // Search results for the picker.
  let results: { value: string; label: string }[] = [];
  if (itemQ) {
    const like = `%${itemQ.replace(/[%_]/g, "")}%`;
    const [sm, ss] = await Promise.all([
      db.from("movies").select("id,title_mn").is("deleted_at", null).or(`title_mn.ilike.${like},title_en.ilike.${like}`).limit(10),
      db.from("series").select("id,title_mn").is("deleted_at", null).or(`title_mn.ilike.${like},title_en.ilike.${like}`).limit(10),
    ]);
    results = [
      ...((sm.data ?? []) as { id: string; title_mn: string }[]).map((m) => ({
        value: `movie:${m.id}`,
        label: `Кино — ${m.title_mn}`,
      })),
      ...((ss.data ?? []) as { id: string; title_mn: string }[]).map((s) => ({
        value: `series:${s.id}`,
        label: `Цуврал — ${s.title_mn}`,
      })),
    ];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/homepage" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Нүүр хуудас руу буцах
        </Link>
        <Link
          href={`/admin/homepage/${section.id}/preview`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-mist-300 hover:border-royal-500/60 hover:text-white"
        >
          <Eye className="h-4 w-4" aria-hidden /> Урьдчилан харах
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">{section.title_mn}</h1>
        <Badge tone={section.status === "published" ? "success" : "default"}>
          {section.status === "published" ? "Нийтлэгдсэн" : "Ноорог"}
        </Badge>
      </div>

      <MessageBanner message={sp.message} error={sp.error} />

      <form action={saveSection} className="space-y-6 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <SectionFields section={section} />
        <Button type="submit">Хадгалах</Button>
      </form>

      {section.query_type === "manual" ? (
        <section className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="text-lg font-medium text-white">Хэсгийн контентууд ({items.length})</h2>

          <form method="GET" className="flex gap-2" role="search">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" aria-hidden />
              <input
                type="search"
                name="itemQ"
                defaultValue={itemQ}
                placeholder="Кино, цуврал хайж нэмэх..."
                aria-label="Контент хайх"
                className="w-full rounded-lg border border-ink-600 bg-ink-900 py-2 pl-9 pr-4 text-sm text-mist-100 placeholder:text-mist-500 focus:border-royal-500"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">Хайх</Button>
          </form>

          {itemQ ? (
            results.length === 0 ? (
              <p className="text-sm text-mist-500">Илэрц олдсонгүй.</p>
            ) : (
              <ul className="space-y-1.5">
                {results.map((r) => (
                  <li key={r.value} className="flex items-center justify-between rounded-lg bg-ink-900/60 px-3 py-2">
                    <span className="text-sm text-mist-100">{r.label}</span>
                    <form action={addSectionItem}>
                      <input type="hidden" name="section_id" value={section.id} />
                      <input type="hidden" name="content" value={r.value} />
                      <button type="submit" className="rounded-md border border-royal-500/50 px-2.5 py-1 text-xs text-royal-300 hover:bg-royal-700/30">
                        Нэмэх
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {pickerOptions.length > 0 ? (
            <details className="rounded-lg border border-ink-600 bg-ink-900/60">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-mist-100">
                Бүх контентоос сонгож нэмэх ({pickerOptions.length})
              </summary>
              <form action={addSectionItemsBulk} className="space-y-3 px-4 pb-4">
                <input type="hidden" name="section_id" value={section.id} />
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-2">
                  {pickerOptions.map((o) => (
                    <label
                      key={o.value}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-mist-300 hover:bg-ink-800"
                    >
                      <input
                        type="checkbox"
                        name="contents"
                        value={o.value}
                        className="h-3.5 w-3.5 accent-royal-500"
                      />
                      {o.label}
                      <span className="text-xs text-mist-500">{o.kind}</span>
                    </label>
                  ))}
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Сонгосныг нэмэх
                </Button>
              </form>
            </details>
          ) : null}

          {items.length === 0 ? (
            <EmptyState title="Контент алга" description="Дээрх хайлтаар кино, цуврал нэмнэ үү." />
          ) : (
            <ol className="space-y-1.5">
              {items.map((it, i) => {
                const info = titleMap.get(`${it.content_type}:${it.content_id}`);
                return (
                  <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-900/60 px-3 py-2">
                    <span className="flex items-center gap-3 truncate">
                      <span className="w-5 text-center font-mono text-xs text-mist-500">{i + 1}</span>
                      {info?.poster_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={info.poster_url} alt="" className="h-10 w-7 rounded object-cover" loading="lazy" />
                      ) : null}
                      <span className="truncate text-sm text-mist-100">
                        {info?.title_mn ?? "(устгагдсан)"}
                        <span className="ml-2 text-xs text-mist-500">{it.content_type === "movie" ? "Кино" : "Цуврал"}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <form action={moveSectionItem}>
                        <input type="hidden" name="section_id" value={section.id} />
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="dir" value="up" />
                        <button type="submit" disabled={i === 0} aria-label="Дээш" className="rounded border border-ink-600 p-1 text-mist-400 hover:text-white disabled:opacity-30">
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        </button>
                      </form>
                      <form action={moveSectionItem}>
                        <input type="hidden" name="section_id" value={section.id} />
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="dir" value="down" />
                        <button type="submit" disabled={i === items.length - 1} aria-label="Доош" className="rounded border border-ink-600 p-1 text-mist-400 hover:text-white disabled:opacity-30">
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        </button>
                      </form>
                      <form action={removeSectionItem}>
                        <input type="hidden" name="section_id" value={section.id} />
                        <input type="hidden" name="id" value={it.id} />
                        <button type="submit" className="rounded border border-ink-600 px-2 py-1 text-xs text-red-400 hover:border-red-500/60">
                          Хасах
                        </button>
                      </form>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : (
        <p className="text-sm text-mist-500">
          Энэ хэсэг автомат query ашигладаг тул контентууд нь query-гээр тодорхойлогдоно. Урьдчилан харах
          хуудсаар үр дүнг шалгаарай.
        </p>
      )}
    </div>
  );
}
