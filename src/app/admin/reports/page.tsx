import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MiniBar } from "../_components/MiniBar";
import { humanizeSeconds } from "../_lib/format";
import { formatMnt } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Download } from "lucide-react";
import {
  revenueByDay,
  subscriberGrowthByMonth,
  churnByMonth,
  watchAggregates,
  topTitles,
  dauByDay,
  partnerPerformance,
} from "./data";

export const dynamic = "force-dynamic";

function ExportLink({ report }: { report: string }) {
  return (
    <a
      href={`/admin/reports/export?report=${report}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-mist-300 transition hover:border-royal-500/60 hover:text-white"
    >
      <Download className="h-3.5 w-3.5" aria-hidden /> CSV татах
    </a>
  );
}

const card = "space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5";
const th = "py-2 pr-4 text-left text-xs uppercase tracking-wide text-mist-500";
const td = "py-2 pr-4";

export default async function ReportsPage() {
  await requireRole("admin");
  const db = createAdminClient();

  const [revenue, growth, churn, watch, top, dau, partners] = await Promise.all([
    revenueByDay(db, 30),
    subscriberGrowthByMonth(db, 12),
    churnByMonth(db, 12),
    watchAggregates(db),
    topTitles(db, 20),
    dauByDay(db, 30),
    partnerPerformance(db),
  ]);

  const revTotal = revenue.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Тайлан</h1>
        <p className="text-xs text-mist-500">CSV файлуудыг Excel шууд нээнэ (UTF-8 BOM-той).</p>
      </div>

      {/* Revenue by day */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-white">Өдрийн орлого — сүүлийн 30 хоног</h2>
          <div className="flex items-center gap-3">
            <Badge tone="accent">Нийт: {formatMnt(revTotal)}</Badge>
            <ExportLink report="revenue_by_day" />
          </div>
        </div>
        <MiniBar
          data={revenue.map((r, i) => ({ label: i % 5 === 0 ? r.label.slice(5) : "", value: r.value }))}
          height={140}
          formatValue={formatMnt}
        />
        <details>
          <summary className="cursor-pointer text-sm text-mist-400 hover:text-white">Хүснэгтээр харах</summary>
          <div className="mt-3 max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr><th className={th}>Огноо</th><th className={th}>Орлого</th></tr></thead>
              <tbody className="divide-y divide-ink-700">
                {revenue.map((r) => (
                  <tr key={r.label}>
                    <td className={`${td} text-mist-400`}>{r.label}</td>
                    <td className={`${td} text-mist-100`}>{formatMnt(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subscriber growth */}
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-white">Захиалагчийн өсөлт (сараар)</h2>
            <ExportLink report="subscriber_growth" />
          </div>
          <MiniBar data={growth.map((g) => ({ label: g.label.slice(5), value: g.value }))} height={120} />
        </section>

        {/* DAU */}
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-white">Идэвхтэй хэрэглэгч (DAU ойролцоо)</h2>
            <ExportLink report="dau" />
          </div>
          <MiniBar data={dau.map((d, i) => ({ label: i % 5 === 0 ? d.label.slice(5) : "", value: d.value }))} height={120} />
          <p className="text-xs text-mist-500">Өдөрт үзэлтийн сешн эхлүүлсэн давтагдаагүй хэрэглэгчид.</p>
        </section>
      </div>

      {/* Churn */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-white">Цуцлалт (churn) — сараар</h2>
          <ExportLink report="churn" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr>
                <th className={th}>Сар</th>
                <th className={th}>Шинэ захиалга</th>
                <th className={th}>Цуцлалт</th>
                <th className={th}>Цуцлалтын хувь</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {churn.map((c) => (
                <tr key={c.month}>
                  <td className={`${td} text-mist-400`}>{c.month}</td>
                  <td className={`${td} text-mist-100`}>{c.newSubs}</td>
                  <td className={`${td} text-mist-100`}>{c.cancelled}</td>
                  <td className={td}>
                    {c.newSubs + c.cancelled > 0 ? (
                      <Badge tone={c.cancelled > c.newSubs ? "danger" : "default"}>
                        {((c.cancelled / Math.max(c.newSubs, 1)) * 100).toFixed(0)}%
                      </Badge>
                    ) : (
                      <span className="text-mist-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-mist-500">Цуцлалтын хувь = тухайн сарын цуцлалт / шинэ захиалга (ойролцоо үзүүлэлт).</p>
      </section>

      {/* Watch time */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-white">Үзэлтийн хугацаа</h2>
          <ExportLink report="watch_time" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><p className="text-xs text-mist-500">Нийт үзсэн</p><p className="text-xl font-semibold text-white">{humanizeSeconds(watch.totalSeconds)}</p></div>
          <div><p className="text-xs text-mist-500">Үзсэн хэрэглэгч</p><p className="text-xl font-semibold text-white">{watch.userCount}</p></div>
          <div><p className="text-xs text-mist-500">Дундаж / хэрэглэгч</p><p className="text-xl font-semibold text-white">{humanizeSeconds(watch.avgSecondsPerUser)}</p></div>
        </div>
      </section>

      {/* Top titles */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-white">Хамгийн их үзсэн кино ба цуврал (топ 20)</h2>
          <ExportLink report="top_titles" />
        </div>
        {top.length === 0 ? (
          <EmptyState title="Үзэлтийн өгөгдөл алга" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Нэр</th>
                  <th className={th}>Төрөл</th>
                  <th className={th}>Үзсэн хугацаа</th>
                  <th className={th}>Үзэгчид</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {top.map((row, i) => (
                  <tr key={`${row.kind}-${row.title}`}>
                    <td className={`${td} text-royal-300`}>{i + 1}</td>
                    <td className={`${td} text-mist-100`}>{row.title}</td>
                    <td className={`${td} text-mist-400`}>{row.kind === "movie" ? "Кино" : "Цуврал"}</td>
                    <td className={`${td} text-mist-100`}>{humanizeSeconds(row.seconds)}</td>
                    <td className={`${td} text-mist-300`}>{row.viewers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Partner performance */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-white">Түншийн гүйцэтгэл</h2>
          <ExportLink report="partner_performance" />
        </div>
        {partners.length === 0 ? (
          <EmptyState title="Түншийн өгөгдөл алга" description="Баталгаажсан, түнштэй холбогдсон эрх шаардлагатай." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr>
                  <th className={th}>Түнш</th>
                  <th className={th}>Үзсэн хугацаа</th>
                  <th className={th}>Үзэлтийн эзлэх хувь</th>
                  <th className={th}>Хамааруулсан орлого (30 хоног)</th>
                  <th className={th}>Хуваах хувь</th>
                  <th className={th}>Түншид ногдох</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {partners.map((p) => (
                  <tr key={p.partner}>
                    <td className={`${td} text-mist-100`}>{p.partner}</td>
                    <td className={`${td} text-mist-300`}>{humanizeSeconds(p.watchSeconds)}</td>
                    <td className={`${td} text-mist-300`}>{(p.watchShare * 100).toFixed(1)}%</td>
                    <td className={`${td} text-mist-100`}>{formatMnt(p.attributedRevenue)}</td>
                    <td className={`${td} text-mist-300`}>{p.sharePercent}%</td>
                    <td className={`${td} font-medium text-royal-300`}>{formatMnt(p.partnerCut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-mist-500">
          Таамаглал: орлогыг сүүлийн 30 хоногийн төлөгдсөн орлогоос, түншийн контентын нийт үзэлтийн
          хугацаанд эзлэх хувиар пропорциональ хамааруулж, түүн дээр гэрээний revenue_share_percent-ийг
          үржүүлж тооцов. Албан ёсны тооцоо биш, чиг хандлагын үзүүлэлт.
        </p>
      </section>
    </div>
  );
}
