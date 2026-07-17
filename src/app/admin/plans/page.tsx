import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { savePlan, togglePlanActive, savePromo, deletePromo } from "./actions";
import { MessageBanner } from "../_components/MessageBanner";
import { fmtDate } from "../_lib/format";
import { formatMnt } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { PromoCode, SubscriptionPlan } from "@/types/db";

export const dynamic = "force-dynamic";

interface MovieOption {
  id: string;
  title_mn: string;
}

function PlanForm({
  plan,
  movies,
  selectedMovieIds,
}: {
  plan: SubscriptionPlan | null;
  movies: MovieOption[];
  selectedMovieIds: string[];
}) {
  return (
    <form action={savePlan} className="space-y-4">
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Slug *" name="slug" defaultValue={plan?.slug ?? ""} pattern="[a-z0-9\-]+" required />
        <Input label="Нэр (MN) *" name="name_mn" defaultValue={plan?.name_mn ?? ""} required />
        <Input label="Нэр (EN) *" name="name_en" defaultValue={plan?.name_en ?? ""} required />
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Input label="Үнэ (₮) *" name="price_mnt" type="number" min={0} defaultValue={plan?.price_mnt ?? ""} required />
        <Input label="Хугацаа (хоног) *" name="duration_days" type="number" min={1} defaultValue={plan?.duration_days ?? 30} required />
        <Input label="Төхөөрөмжийн лимит" name="device_limit" type="number" min={1} max={20} defaultValue={plan?.device_limit ?? 2} required />
        <Input label="Зэрэг үзэх лимит" name="stream_limit" type="number" min={1} max={10} defaultValue={plan?.stream_limit ?? 1} required />
        <Input label="Туршилтын хоног" name="trial_days" type="number" min={0} max={90} defaultValue={plan?.trial_days ?? 0} required />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={plan ? `feat-${plan.id}` : "feat-new"} className="block text-sm text-mist-300">
          Онцлогууд (мөр бүрд нэг)
        </label>
        <textarea
          id={plan ? `feat-${plan.id}` : "feat-new"}
          name="features_mn"
          rows={4}
          defaultValue={plan?.features_mn.join("\n") ?? ""}
          placeholder={"HD чанар\n2 төхөөрөмж\nХадмал орчуулга"}
          className="w-full rounded-lg border border-ink-600 bg-ink-900 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-mist-300">
        <input type="checkbox" name="is_active" defaultChecked={plan?.is_active ?? true} className="h-4 w-4 accent-royal-500" />
        Идэвхтэй (сайтад харагдана)
      </label>
      <div className="space-y-1.5">
        <p className="text-sm text-mist-300">Багцад багтах кинонууд ({selectedMovieIds.length} сонгосон)</p>
        <p className="text-xs text-mist-500">
          Кино сонговол энэ багцын эрхтэй хэрэглэгч зөвхөн сонгосон киног үзнэ.
          Юу ч сонгохгүй бол багц бүх контентод эрх нээнэ.
        </p>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ink-600 bg-ink-900 p-2">
          {movies.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-mist-300 hover:bg-ink-800">
              <input
                type="checkbox"
                name="movie_ids"
                value={m.id}
                defaultChecked={selectedMovieIds.includes(m.id)}
                className="h-3.5 w-3.5 accent-royal-500"
              />
              {m.title_mn}
            </label>
          ))}
          {movies.length === 0 ? <p className="px-2 py-1 text-xs text-mist-500">Нийтлэгдсэн кино алга</p> : null}
        </div>
      </div>
      <Button type="submit" size="sm">{plan ? "Хадгалах" : "Багц үүсгэх"}</Button>
    </form>
  );
}

function PromoForm({ promo }: { promo: PromoCode | null }) {
  return (
    <form action={savePromo} className="space-y-4">
      {promo ? <input type="hidden" name="id" value={promo.id} /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Код *" name="code" defaultValue={promo?.code ?? ""} placeholder="SUMMER25" required />
        <Input label="Хөнгөлөлт (%)" name="discount_percent" type="number" min={1} max={100} defaultValue={promo?.discount_percent ?? ""} />
        <Input label="Урамшууллын хоног" name="bonus_days" type="number" min={1} max={365} defaultValue={promo?.bonus_days ?? ""} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Хэрэглээний лимит" name="max_uses" type="number" min={1} defaultValue={promo?.max_uses ?? ""} />
        <Input label="Эхлэх огноо *" name="valid_from" type="date" defaultValue={promo ? promo.valid_from.slice(0, 10) : ""} required />
        <Input label="Дуусах огноо" name="valid_until" type="date" defaultValue={promo?.valid_until ? promo.valid_until.slice(0, 10) : ""} />
      </div>
      <p className="text-xs text-mist-500">Хөнгөлөлтийн хувь ЭСВЭЛ урамшууллын хоногийн зөвхөн нэгийг бөглөнө.</p>
      <label className="flex items-center gap-2 text-sm text-mist-300">
        <input type="checkbox" name="is_active" defaultChecked={promo?.is_active ?? true} className="h-4 w-4 accent-royal-500" />
        Идэвхтэй
      </label>
      <Button type="submit" size="sm">{promo ? "Хадгалах" : "Промо код үүсгэх"}</Button>
    </form>
  );
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; message?: string; error?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const tab = sp.tab === "promo" ? "promo" : "plans";
  const db = createAdminClient();

  const [plansRes, promosRes, moviesRes, planMoviesRes] = await Promise.all([
    db.from("subscription_plans").select("*").order("price_mnt"),
    db.from("promo_codes").select("*").order("valid_from", { ascending: false }),
    db
      .from("movies")
      .select("id,title_mn")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("title_mn")
      .limit(500),
    db.from("plan_movies").select("plan_id,movie_id"),
  ]);
  const plans = (plansRes.data ?? []) as SubscriptionPlan[];
  const promos = (promosRes.data ?? []) as PromoCode[];
  const movieOptions = (moviesRes.data ?? []) as { id: string; title_mn: string }[];
  const planMovieMap = new Map<string, string[]>();
  for (const r of (planMoviesRes.data ?? []) as { plan_id: string; movie_id: string }[]) {
    const list = planMovieMap.get(r.plan_id) ?? [];
    list.push(r.movie_id);
    planMovieMap.set(r.plan_id, list);
  }

  const tabCls = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? "bg-royal-700/30 text-royal-300" : "text-mist-400 hover:bg-ink-800 hover:text-white"
    }`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold text-white">Багцууд ба промо кодууд</h1>
      <MessageBanner message={sp.message} error={sp.error} />

      <nav className="flex gap-2 border-b border-ink-700 pb-3" aria-label="Табууд">
        <Link href="/admin/plans" className={tabCls(tab === "plans")}>Багцууд</Link>
        <Link href="/admin/plans?tab=promo" className={tabCls(tab === "promo")}>Промо кодууд</Link>
      </nav>

      {tab === "plans" ? (
        <div className="space-y-4">
          <details className="rounded-xl border border-dashed border-ink-600 bg-ink-800/60">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-royal-300">+ Шинэ багц үүсгэх</summary>
            <div className="border-t border-ink-700 p-5">
              <PlanForm plan={null} movies={movieOptions} selectedMovieIds={[]} />
            </div>
          </details>

          {plans.length === 0 ? (
            <EmptyState title="Багц алга" description="Дээрх маягтаар эхний багцаа үүсгэнэ үү." />
          ) : (
            plans.map((p) => (
              <details key={p.id} className="group rounded-xl border border-ink-600 bg-ink-800">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <span className="flex items-center gap-3">
                    <span className="font-medium text-white">{p.name_mn}</span>
                    <span className="text-sm text-mist-400">{formatMnt(p.price_mnt)} / {p.duration_days} хоног</span>
                    <Badge tone={p.is_active ? "success" : "default"}>{p.is_active ? "Идэвхтэй" : "Идэвхгүй"}</Badge>
                  </span>
                  <ChevronDown className="h-4 w-4 text-mist-500 transition group-open:rotate-180" aria-hidden />
                </summary>
                <div className="space-y-4 border-t border-ink-700 p-5">
                  <PlanForm plan={p} movies={movieOptions} selectedMovieIds={planMovieMap.get(p.id) ?? []} />
                  <form action={togglePlanActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-xs text-mist-400 hover:text-white">
                      {p.is_active ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                    </button>
                  </form>
                </div>
              </details>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <details className="rounded-xl border border-dashed border-ink-600 bg-ink-800/60">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-royal-300">+ Шинэ промо код</summary>
            <div className="border-t border-ink-700 p-5"><PromoForm promo={null} /></div>
          </details>

          {promos.length === 0 ? (
            <EmptyState title="Промо код алга" description="Дээрх маягтаар эхний промо кодоо үүсгэнэ үү." />
          ) : (
            promos.map((p) => {
              const expired = p.valid_until ? new Date(p.valid_until) < new Date() : false;
              return (
                <details key={p.id} className="group rounded-xl border border-ink-600 bg-ink-800">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <span className="flex items-center gap-3">
                      <span className="font-mono font-medium text-white">{p.code}</span>
                      <span className="text-sm text-mist-400">
                        {p.discount_percent !== null ? `${p.discount_percent}% хөнгөлөлт` : `${p.bonus_days} хоног урамшуулал`}
                      </span>
                      <span className="text-xs text-mist-500">
                        {p.used_count}/{p.max_uses ?? "∞"} ашигласан · {fmtDate(p.valid_from)} → {p.valid_until ? fmtDate(p.valid_until) : "хугацаагүй"}
                      </span>
                      <Badge tone={expired ? "danger" : p.is_active ? "success" : "default"}>
                        {expired ? "Хугацаа дууссан" : p.is_active ? "Идэвхтэй" : "Идэвхгүй"}
                      </Badge>
                    </span>
                    <ChevronDown className="h-4 w-4 text-mist-500 transition group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="space-y-4 border-t border-ink-700 p-5">
                    <PromoForm promo={p} />
                    <form action={deletePromo}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">Устгах</button>
                    </form>
                  </div>
                </details>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
