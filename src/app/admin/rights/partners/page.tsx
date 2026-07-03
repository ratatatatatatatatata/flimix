import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { savePartner, deletePartner } from "../actions";
import { MessageBanner } from "../../_components/MessageBanner";
import { fmtDate } from "../../_lib/format";
import { formatMnt } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import type { ContentPartner } from "@/types/db";
import type { PartnerRevenueShare } from "../../_lib/types";

export const dynamic = "force-dynamic";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const db = createAdminClient();

  const [partnersRes, sharesRes, rightsRes] = await Promise.all([
    db.from("content_partners").select("*").order("name"),
    db
      .from("partner_revenue_shares")
      .select("*")
      .order("period_start", { ascending: false })
      .limit(100),
    db.from("content_rights").select("partner_id"),
  ]);
  const partners = (partnersRes.data ?? []) as ContentPartner[];
  const shares = (sharesRes.data ?? []) as PartnerRevenueShare[];
  const rightCounts = new Map<string, number>();
  for (const r of (rightsRes.data ?? []) as { partner_id: string | null }[]) {
    if (r.partner_id) rightCounts.set(r.partner_id, (rightCounts.get(r.partner_id) ?? 0) + 1);
  }
  const partnerName = new Map(partners.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <Link href="/admin/rights" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Эрхийн удирдлага руу буцах
      </Link>
      <h1 className="text-2xl font-semibold text-white">Түнш байгууллагууд</h1>
      <MessageBanner message={sp.message} error={sp.error} />

      <form action={savePartner} className="grid items-end gap-3 rounded-xl border border-ink-600 bg-ink-800 p-4 md:grid-cols-4">
        <Input label="Нэр *" name="name" required />
        <Input label="Имэйл" name="contact_email" type="email" />
        <Input label="Утас" name="contact_phone" />
        <Button type="submit" size="sm">Түнш нэмэх</Button>
      </form>

      {partners.length === 0 ? (
        <EmptyState title="Түнш алга" description="Дээрх маягтаар эхний түнш байгууллагаа бүртгэнэ үү." />
      ) : (
        <div className="space-y-2">
          {partners.map((p) => (
            <details key={p.id} className="group rounded-xl border border-ink-600 bg-ink-800">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4">
                <span>
                  <span className="font-medium text-white">{p.name}</span>
                  <span className="ml-3 text-xs text-mist-500">
                    {rightCounts.get(p.id) ?? 0} эрх · бүртгэсэн {fmtDate(p.created_at)}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-mist-500 transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-3 border-t border-ink-700 p-5">
                <form action={savePartner} className="grid items-end gap-3 md:grid-cols-4">
                  <input type="hidden" name="id" value={p.id} />
                  <Input label="Нэр *" name="name" defaultValue={p.name} required />
                  <Input label="Имэйл" name="contact_email" type="email" defaultValue={p.contact_email ?? ""} />
                  <Input label="Утас" name="contact_phone" defaultValue={p.contact_phone ?? ""} />
                  <Button type="submit" size="sm" variant="secondary">Хадгалах</Button>
                </form>
                <form action={deletePartner}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                    Түнш устгах
                  </button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">Орлого хуваалтын бүртгэл</h2>
        {shares.length === 0 ? (
          <EmptyState
            title="Орлого хуваалтын бичилт алга"
            description="Тайлангийн модулиас тооцоолсон түншийн орлого хуваалтууд энд харагдана."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-600">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-mist-500">
                <tr>
                  <th className="px-4 py-3">Түнш</th>
                  <th className="px-4 py-3">Хугацаа</th>
                  <th className="px-4 py-3">Хувь</th>
                  <th className="px-4 py-3">Дүн</th>
                  <th className="px-4 py-3">Тэмдэглэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700 bg-ink-800/60">
                {shares.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-mist-100">{partnerName.get(s.partner_id) ?? "—"}</td>
                    <td className="px-4 py-2 text-mist-400">
                      {fmtDate(s.period_start)} → {fmtDate(s.period_end)}
                    </td>
                    <td className="px-4 py-2 text-mist-300">{s.percent}%</td>
                    <td className="px-4 py-2 text-mist-100">{formatMnt(s.amount_mnt)}</td>
                    <td className="px-4 py-2 text-xs text-mist-400">{s.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
