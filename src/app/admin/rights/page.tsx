import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBanner } from "../_components/MessageBanner";
import { Pagination } from "../_components/Pagination";
import { rightsStatusLabel, rightsStatusTone, fmtDate, daysLeft } from "../_lib/format";
import Link from "next/link";
import { Plus, Handshake } from "lucide-react";
import type { ContentPartner, ContentRight, RightsApprovalStatus } from "@/types/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const EXPIRY_FILTERS = ["30", "60", "90"] as const;

export default async function AdminRightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    expiring?: string;
    page?: string;
    message?: string;
    error?: string;
  }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const status = ["pending", "approved", "rejected"].includes(sp.status ?? "")
    ? (sp.status as RightsApprovalStatus)
    : undefined;
  const expiring = EXPIRY_FILTERS.includes((sp.expiring ?? "") as (typeof EXPIRY_FILTERS)[number])
    ? Number(sp.expiring)
    : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const db = createAdminClient();
  let query = db
    .from("content_rights")
    .select("*", { count: "exact" })
    .order("rights_end", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("approval_status", status);
  if (expiring) {
    const nowIso = new Date().toISOString();
    query = query
      .gte("rights_end", nowIso)
      .lte("rights_end", new Date(Date.now() + expiring * 86_400_000).toISOString());
  }
  const { data, count } = await query;
  const rights = (data ?? []) as ContentRight[];

  // Resolve content titles + partner names.
  const movieIds = rights.filter((r) => r.content_type === "movie").map((r) => r.content_id);
  const seriesIds = rights.filter((r) => r.content_type === "series").map((r) => r.content_id);
  const partnerIds = [...new Set(rights.map((r) => r.partner_id).filter((x): x is string => Boolean(x)))];
  const [moviesRes, seriesRes, partnersRes] = await Promise.all([
    movieIds.length
      ? db.from("movies").select("id,title_mn").in("id", movieIds)
      : Promise.resolve({ data: [] as { id: string; title_mn: string }[] }),
    seriesIds.length
      ? db.from("series").select("id,title_mn").in("id", seriesIds)
      : Promise.resolve({ data: [] as { id: string; title_mn: string }[] }),
    partnerIds.length
      ? db.from("content_partners").select("id,name").in("id", partnerIds)
      : Promise.resolve({ data: [] as Pick<ContentPartner, "id" | "name">[] }),
  ]);
  const titleMap = new Map<string, string>();
  for (const m of (moviesRes.data ?? []) as { id: string; title_mn: string }[]) titleMap.set(`movie:${m.id}`, m.title_mn);
  for (const s of (seriesRes.data ?? []) as { id: string; title_mn: string }[]) titleMap.set(`series:${s.id}`, s.title_mn);
  const partnerMap = new Map(
    ((partnersRes.data ?? []) as Pick<ContentPartner, "id" | "name">[]).map((p) => [p.id, p.name]),
  );

  const listParams: Record<string, string> = {};
  if (status) listParams.status = status;
  if (expiring) listParams.expiring = String(expiring);

  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-royal-500/60 bg-royal-700/30 text-royal-300"
          : "border-ink-600 bg-ink-800 text-mist-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Эрхийн удирдлага</h1>
        <div className="flex gap-2">
          <Link href="/admin/rights/partners">
            <Button variant="secondary" size="sm">
              <Handshake className="h-4 w-4" aria-hidden /> Түншүүд
            </Button>
          </Link>
          <Link href="/admin/rights/new">
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden /> Шинэ эрх
            </Button>
          </Link>
        </div>
      </div>

      <MessageBanner message={sp.message} error={sp.error} />

      <div className="flex flex-wrap items-center gap-2">
        {chip("/admin/rights", "Бүгд", !status && !expiring)}
        {(["pending", "approved", "rejected"] as const).map((s) =>
          chip(`/admin/rights?status=${s}`, rightsStatusLabel[s], status === s),
        )}
        <span className="mx-1 text-xs text-mist-600">|</span>
        {EXPIRY_FILTERS.map((d) =>
          chip(`/admin/rights?expiring=${d}`, `${d} хоногт дуусах`, expiring === Number(d)),
        )}
      </div>

      {rights.length === 0 ? (
        <EmptyState
          title="Эрхийн бүртгэл алга"
          description="Шүүлтүүрт тохирох контентын эрх олдсонгүй."
          action={
            <Link href="/admin/rights/new">
              <Button size="sm">Шинэ эрх бүртгэх</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-600">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-mist-500">
              <tr>
                <th className="px-4 py-3">Контент</th>
                <th className="px-4 py-3">Эрх эзэмшигч</th>
                <th className="px-4 py-3">Түнш</th>
                <th className="px-4 py-3">Гэрээ №</th>
                <th className="px-4 py-3">Хугацаа</th>
                <th className="px-4 py-3">Үлдсэн</th>
                <th className="px-4 py-3">Төлөв</th>
                <th className="px-4 py-3 text-right">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-800/60">
              {rights.map((r) => {
                const left = daysLeft(r.rights_end);
                return (
                  <tr key={r.id} className="hover:bg-ink-800">
                    <td className="px-4 py-2">
                      <p className="font-medium text-mist-100">
                        {titleMap.get(`${r.content_type}:${r.content_id}`) ?? "(устгагдсан)"}
                      </p>
                      <p className="text-xs text-mist-500">{r.content_type === "movie" ? "Кино" : "Цуврал"}</p>
                    </td>
                    <td className="px-4 py-2 text-mist-300">{r.rights_owner}</td>
                    <td className="px-4 py-2 text-mist-300">{r.partner_id ? (partnerMap.get(r.partner_id) ?? "—") : "—"}</td>
                    <td className="px-4 py-2 text-mist-400">{r.contract_number ?? "—"}</td>
                    <td className="px-4 py-2 text-mist-400">
                      {fmtDate(r.rights_start)} → {fmtDate(r.rights_end)}
                    </td>
                    <td className="px-4 py-2">
                      {left < 0 ? (
                        <Badge tone="danger">Дууссан</Badge>
                      ) : left <= 30 ? (
                        <Badge tone={left <= 7 ? "danger" : "warning"}>{left} хоног</Badge>
                      ) : (
                        <span className="text-mist-400">{left} хоног</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={rightsStatusTone[r.approval_status]}>{rightsStatusLabel[r.approval_status]}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/rights/${r.id}`}
                        className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 hover:border-royal-500/60 hover:text-white"
                      >
                        Дэлгэрэнгүй
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/admin/rights" params={listParams} />
    </div>
  );
}
