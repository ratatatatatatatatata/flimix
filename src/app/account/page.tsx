import Link from "next/link";
import {
  Crown,
  Heart,
  History,
  MonitorSmartphone,
  Play,
  Receipt,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatMnt, t } from "@/lib/i18n";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/db";

interface SubscriptionRow {
  id: string;
  status: SubscriptionStatus;
  current_period_end: string;
  cancelled_at: string | null;
  plan: Pick<SubscriptionPlan, "name_mn" | "price_mnt"> | null;
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

const quickLinks = [
  { href: "/account/continue", label: t.continueWatching, icon: Play },
  { href: "/account/favorites", label: t.favorites, icon: Heart },
  { href: "/account/history", label: t.watchHistory, icon: History },
  { href: "/account/devices", label: t.devices, icon: MonitorSmartphone },
  { href: "/account/payments", label: t.paymentHistory, icon: Receipt },
  { href: "/account/subscription", label: t.subscription, icon: Crown },
];

export default async function AccountOverviewPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const [{ data: userData }, { data: subData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("subscriptions")
      .select(
        "id, status, current_period_end, cancelled_at, plan:subscription_plans(name_mn, price_mnt)",
      )
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sub = (subData ?? null) as SubscriptionRow | null;
  const memberSince = userData?.user?.created_at ?? null;
  const hasAccess =
    sub !== null &&
    ["active", "trial", "cancelled"].includes(sub.status) &&
    new Date(sub.current_period_end).getTime() > Date.now();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.myAccount}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Бүртгэл, багц болон тохиргоогоо эндээс удирдана.
        </p>
      </div>

      {/* Identity card */}
      <section className="card-surface rounded-xl border border-ink-600 bg-ink-800 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-royal-700/30 text-lg font-bold text-royal-300">
            {(session.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">
              {session.email ?? "Имэйл бүртгэлгүй"}
            </p>
            {memberSince ? (
              <p className="text-sm text-mist-400">
                Гишүүн болсон: {formatDate(memberSince)}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Subscription status card */}
      <section className="rounded-xl border border-ink-600 bg-ink-800 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-mist-400">{t.subscription}</p>
            {hasAccess && sub ? (
              <>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-white">
                    {sub.plan?.name_mn ?? "Багц"}
                  </p>
                  <Badge tone={statusTones[sub.status]}>
                    {statusLabels[sub.status]}
                  </Badge>
                </div>
                <p className="text-sm text-mist-300">
                  {sub.plan ? `${formatMnt(sub.plan.price_mnt)}${t.perMonth}` : null}
                </p>
                <p className="text-sm text-mist-400">
                  {sub.status === "cancelled"
                    ? `Эрх дуусах огноо: ${formatDate(sub.current_period_end)}`
                    : `${t.renewalDate}: ${formatDate(sub.current_period_end)}`}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-white">
                    Багц идэвхгүй
                  </p>
                  <Badge tone="default">Идэвхгүй</Badge>
                </div>
                <p className="text-sm text-mist-400">
                  Багц идэвхжүүлж бүх контентыг хязгааргүй үзээрэй.
                </p>
              </>
            )}
          </div>
          <Link
            href={hasAccess ? "/account/subscription" : "/subscribe"}
            className="shrink-0"
          >
            <Button variant={hasAccess ? "secondary" : "primary"}>
              {hasAccess ? "Дэлгэрэнгүй" : t.choosePlan}
            </Button>
          </Link>
        </div>
      </section>

      {/* Quick links */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-mist-400">
          Түргэн холбоос
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-4 transition hover:border-royal-500/50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-700 text-royal-300 transition group-hover:bg-royal-700/30">
                <link.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-mist-100 group-hover:text-white">
                {link.label}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
