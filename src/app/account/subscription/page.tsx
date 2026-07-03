import Link from "next/link";
import { Check, Crown } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatMnt, t } from "@/lib/i18n";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/db";
import { cancelSubscription } from "./actions";

interface SubscriptionRow {
  id: string;
  status: SubscriptionStatus;
  started_at: string;
  current_period_end: string;
  cancelled_at: string | null;
  plan: Pick<
    SubscriptionPlan,
    "name_mn" | "price_mnt" | "device_limit" | "stream_limit" | "features_mn"
  > | null;
}

const statusLabels: Record<SubscriptionStatus, string> = {
  trial: "Туршилтын хугацаа",
  active: "Идэвхтэй",
  past_due: "Төлбөр хоцорсон",
  cancelled: "Цуцлагдсан",
  expired: "Дууссан",
};

const statusTones: Record<
  SubscriptionStatus,
  "default" | "accent" | "success" | "warning" | "danger"
> = {
  trial: "accent",
  active: "success",
  past_due: "warning",
  cancelled: "warning",
  expired: "danger",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function SubscriptionPage() {
  const session = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      `id, status, started_at, current_period_end, cancelled_at,
       plan:subscription_plans(name_mn, price_mnt, device_limit, stream_limit, features_mn)`,
    )
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sub = (data ?? null) as SubscriptionRow | null;
  const periodEndFuture =
    sub !== null && new Date(sub.current_period_end).getTime() > Date.now();
  const isRunning =
    sub !== null &&
    (sub.status === "active" || sub.status === "trial") &&
    periodEndFuture;
  const isCancelledWithAccess =
    sub !== null && sub.status === "cancelled" && periodEndFuture;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.subscription}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Багцын мэдээлэл, сунгалт болон цуцлалтаа эндээс удирдана.
        </p>
      </div>

      {isRunning || isCancelledWithAccess ? (
        <>
          <section className="rounded-xl border border-ink-600 bg-ink-800 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-royal-700/30 text-royal-300">
                    <Crown className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-lg font-semibold text-white">
                    {sub?.plan?.name_mn ?? "Багц"}
                  </p>
                  {sub ? (
                    <Badge tone={statusTones[sub.status]}>
                      {statusLabels[sub.status]}
                    </Badge>
                  ) : null}
                </div>
                {sub?.plan ? (
                  <p className="text-2xl font-bold text-white">
                    {formatMnt(sub.plan.price_mnt)}
                    <span className="text-sm font-normal text-mist-400">
                      {t.perMonth}
                    </span>
                  </p>
                ) : null}
                <div className="space-y-1 text-sm text-mist-300">
                  <p>Эхэлсэн: {sub ? formatDate(sub.started_at) : "—"}</p>
                  <p>
                    {isCancelledWithAccess
                      ? `Үзэх эрх дуусах огноо: ${sub ? formatDate(sub.current_period_end) : "—"}`
                      : `${t.renewalDate}: ${sub ? formatDate(sub.current_period_end) : "—"}`}
                  </p>
                  {sub?.plan ? (
                    <p>
                      Төхөөрөмж: {sub.plan.device_limit} · Зэрэг үзэх:{" "}
                      {sub.plan.stream_limit}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {sub?.plan?.features_mn && sub.plan.features_mn.length > 0 ? (
              <ul className="mt-4 grid gap-2 border-t border-ink-600/70 pt-4 sm:grid-cols-2">
                {sub.plan.features_mn.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-mist-300"
                  >
                    <Check
                      className="h-4 w-4 shrink-0 text-royal-300"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {isCancelledWithAccess ? (
            <section className="rounded-xl border border-amber-700/40 bg-amber-900/15 p-5">
              <p className="text-sm text-amber-200">
                Багц цуцлагдсан. Төлбөр төлөгдсөн хугацаа буюу{" "}
                <span className="font-semibold">
                  {sub ? formatDate(sub.current_period_end) : ""}
                </span>{" "}
                хүртэл контент үзэх эрхтэй хэвээр байна. Дараа нь дахин
                идэвхжүүлж болно.
              </p>
              <Link href="/subscribe" className="mt-4 inline-block">
                <Button size="sm">Дахин идэвхжүүлэх</Button>
              </Link>
            </section>
          ) : (
            <section className="rounded-xl border border-ink-600 bg-ink-800 p-5">
              <h2 className="font-medium text-white">{t.cancelSubscription}</h2>
              <p className="mt-1 text-sm text-mist-400">
                Цуцалсан ч төлбөр төлсөн хугацааныхаа эцэс буюу{" "}
                {sub ? formatDate(sub.current_period_end) : ""} хүртэл контент
                үзэх эрх тань хадгалагдана. Дахин төлбөр авахгүй.
              </p>
              <form action={cancelSubscription} className="mt-4">
                <input
                  type="hidden"
                  name="subscription_id"
                  value={sub?.id ?? ""}
                />
                <Button type="submit" variant="danger" size="sm">
                  {t.cancelSubscription}
                </Button>
              </form>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-xl border border-ink-600 bg-ink-800 p-6 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-royal-700/30">
            <Crown className="h-7 w-7 text-royal-300" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">
            {sub?.status === "expired" || sub?.status === "past_due"
              ? t.subscriptionExpired
              : "Багц идэвхгүй байна"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">
            Багц идэвхжүүлж бүх кино, цувралыг хязгааргүй, өндөр чанартайгаар
            үзээрэй. Далд төлбөр байхгүй.
          </p>
          <Link href="/subscribe" className="mt-6 inline-block">
            <Button size="lg">{t.choosePlan}</Button>
          </Link>
        </section>
      )}
    </div>
  );
}
