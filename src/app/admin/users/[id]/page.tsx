import { requireRole, hasRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { grantRole, revokeRole, suspendUser, restoreUser, resetDeviceSessions } from "../actions";
import { MessageBanner } from "../../_components/MessageBanner";
import {
  roleLabel,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  fmtDate,
  fmtDateTime,
} from "../../_lib/format";
import { formatMnt } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  AuditLog,
  Payment,
  Profile,
  Subscription,
  SubscriptionPlan,
  UserDevice,
  UserRole,
  WatchSession,
} from "@/types/db";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const session = await requireRole("admin");
  const isSuperAdmin = hasRole(session, "super_admin");
  const { id } = await params;
  const sp = await searchParams;
  const db = createAdminClient();

  const { data: authData, error: authErr } = await db.auth.admin.getUserById(id);
  if (authErr || !authData?.user) notFound();
  const authUser = authData.user;
  const banned =
    "banned_until" in authUser && Boolean((authUser as { banned_until?: string | null }).banned_until);

  const [profileRes, rolesRes, subsRes, plansRes, paymentsRes, devicesRes, sessionsRes, auditRes] =
    await Promise.all([
      db.from("profiles").select("*").eq("user_id", id).limit(1),
      db.from("user_roles").select("role").eq("user_id", id),
      db.from("subscriptions").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      db.from("subscription_plans").select("id,name_mn"),
      db.from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(30),
      db.from("user_devices").select("*").eq("user_id", id).order("last_active_at", { ascending: false }),
      db.from("watch_sessions").select("*").eq("user_id", id).order("started_at", { ascending: false }).limit(15),
      db
        .from("audit_logs")
        .select("*")
        .or(`actor_id.eq.${id},entity_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const profile = ((profileRes.data ?? []) as Profile[])[0] ?? null;
  const roles = ((rolesRes.data ?? []) as { role: UserRole }[]).map((r) => r.role);
  const isTargetSuperAdmin = roles.includes("super_admin");
  const subs = (subsRes.data ?? []) as Subscription[];
  const planName = new Map(
    ((plansRes.data ?? []) as Pick<SubscriptionPlan, "id" | "name_mn">[]).map((p) => [p.id, p.name_mn]),
  );
  const payments = (paymentsRes.data ?? []) as Payment[];
  const devices = (devicesRes.data ?? []) as UserDevice[];
  const sessions = (sessionsRes.data ?? []) as WatchSession[];
  const audits = (auditRes.data ?? []) as AuditLog[];
  const currentSub = subs[0] ?? null;
  const activeSessions = sessions.filter((s) => s.status === "active").length;

  const card = "space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-5";

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Хэрэглэгчид рүү буцах
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">{authUser.email ?? "(имэйлгүй)"}</h1>
        {banned ? <Badge tone="danger">Түдгэлзүүлсэн</Badge> : <Badge tone="success">Идэвхтэй</Badge>}
        {roles.map((r) => (
          <Badge key={r} tone={r === "super_admin" ? "danger" : r === "admin" ? "accent" : "default"}>
            {roleLabel[r]}
          </Badge>
        ))}
      </div>

      <MessageBanner message={sp.message} error={sp.error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-lg font-medium text-white">Ерөнхий мэдээлэл</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-mist-500">Нэр</dt><dd className="text-mist-100">{profile?.display_name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-mist-500">Бүртгүүлсэн</dt><dd className="text-mist-100">{fmtDateTime(authUser.created_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-mist-500">Сүүлд нэвтэрсэн</dt><dd className="text-mist-100">{fmtDateTime(authUser.last_sign_in_at ?? null)}</dd></div>
            <div className="flex justify-between"><dt className="text-mist-500">Имэйл баталгаажилт</dt><dd className="text-mist-100">{authUser.email_confirmed_at ? "Тийм" : "Үгүй"}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            {isTargetSuperAdmin ? (
              <p className="text-xs text-amber-300">Супер админ бүртгэлд үйлдэл хийх боломжгүй.</p>
            ) : banned ? (
              <form action={restoreUser}>
                <input type="hidden" name="user_id" value={id} />
                <Button type="submit" size="sm" variant="secondary">Сэргээх</Button>
              </form>
            ) : (
              <form action={suspendUser}>
                <input type="hidden" name="user_id" value={id} />
                <Button type="submit" size="sm" variant="danger">Түдгэлзүүлэх</Button>
              </form>
            )}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-lg font-medium text-white">Эрхийн удирдлага</h2>
          {isTargetSuperAdmin ? (
            <p className="text-sm text-amber-300">Супер админы эрхийг өөрчлөх боломжгүй.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["content_manager", "admin"] as const).map((r) => {
                  const has = roles.includes(r);
                  const allowed = r === "content_manager" || isSuperAdmin;
                  return (
                    <form key={r} action={has ? revokeRole : grantRole}>
                      <input type="hidden" name="user_id" value={id} />
                      <input type="hidden" name="role" value={r} />
                      <Button type="submit" size="sm" variant={has ? "danger" : "secondary"} disabled={!allowed}>
                        {roleLabel[r]} {has ? "хураах" : "олгох"}
                      </Button>
                    </form>
                  );
                })}
              </div>
              {!isSuperAdmin ? (
                <p className="text-xs text-mist-500">Админ эрх олгох/хураах эрх зөвхөн супер админд бий.</p>
              ) : null}
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="text-lg font-medium text-white">Багцын мэдээлэл</h2>
          {currentSub ? (
            <p className="text-sm text-mist-100">
              {planName.get(currentSub.plan_id) ?? "Багц"} ·{" "}
              <Badge tone={subscriptionStatusTone[currentSub.status]}>
                {subscriptionStatusLabel[currentSub.status]}
              </Badge>{" "}
              <span className="text-mist-400">— {fmtDate(currentSub.current_period_end)} хүртэл</span>
            </p>
          ) : (
            <p className="text-sm text-mist-500">Багцын захиалга байхгүй.</p>
          )}
          {subs.length > 1 ? (
            <ul className="space-y-1 text-sm text-mist-400">
              {subs.slice(1).map((s) => (
                <li key={s.id}>
                  {planName.get(s.plan_id) ?? "Багц"} · {subscriptionStatusLabel[s.status]} · {fmtDate(s.started_at)} → {fmtDate(s.current_period_end)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={card}>
          <h2 className="text-lg font-medium text-white">Төхөөрөмж ба сешн</h2>
          <p className="text-sm text-mist-400">
            {devices.length} бүртгэлтэй төхөөрөмж · {activeSessions} идэвхтэй үзэлтийн сешн
          </p>
          {devices.length === 0 ? (
            <EmptyState title="Төхөөрөмж алга" />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {devices.map((d) => (
                <li key={d.id} className="flex justify-between rounded-lg bg-ink-900/60 px-3 py-2">
                  <span className="text-mist-100">{d.device_name} <span className="text-xs text-mist-500">({d.device_type})</span></span>
                  <span className="text-xs text-mist-500">{fmtDateTime(d.last_active_at)}</span>
                </li>
              ))}
            </ul>
          )}
          {!isTargetSuperAdmin ? (
            <form action={resetDeviceSessions}>
              <input type="hidden" name="user_id" value={id} />
              <Button type="submit" size="sm" variant="secondary">Төхөөрөмжийн сешн шинэчлэх</Button>
            </form>
          ) : null}
          <p className="text-xs text-mist-600">Бүх төхөөрөмжийг устгаж, идэвхтэй үзэлтийн сешнүүдийг дуусгана.</p>
        </section>
      </div>

      <section className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="text-lg font-medium text-white">Төлбөрийн түүх</h2>
        {payments.length === 0 ? (
          <EmptyState title="Төлбөрийн бичилт алга" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-mist-500">
                <tr>
                  <th className="py-2 pr-4">Огноо</th>
                  <th className="py-2 pr-4">Дүн</th>
                  <th className="py-2 pr-4">Суваг</th>
                  <th className="py-2 pr-4">Төлөв</th>
                  <th className="py-2">Баримт №</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 text-mist-400">{fmtDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="py-2 pr-4 text-mist-100">{formatMnt(p.amount_mnt)}</td>
                    <td className="py-2 pr-4 text-mist-300">{p.provider}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={paymentStatusTone[p.status]}>{paymentStatusLabel[p.status]}</Badge>
                    </td>
                    <td className="py-2 text-mist-400">{p.receipt_number ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="text-lg font-medium text-white">Сүүлийн үзэлтийн сешнүүд</h2>
          {sessions.length === 0 ? (
            <EmptyState title="Сешн алга" />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg bg-ink-900/60 px-3 py-2">
                  <span className="text-mist-300">
                    {s.content_type === "movie" ? "Кино" : "Анги"} · {fmtDateTime(s.started_at)}
                  </span>
                  <Badge tone={s.status === "active" ? "success" : s.status === "terminated" ? "danger" : "default"}>
                    {s.status === "active" ? "Идэвхтэй" : s.status === "terminated" ? "Таслагдсан" : "Дууссан"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="text-lg font-medium text-white">Холбоотой аудит бичилтүүд</h2>
          {audits.length === 0 ? (
            <EmptyState title="Аудит бичилт алга" />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {audits.map((a) => (
                <li key={a.id} className="rounded-lg bg-ink-900/60 px-3 py-2">
                  <p className="text-mist-100">
                    <span className="font-mono text-xs text-royal-300">{a.action}</span>{" "}
                    <span className="text-xs text-mist-500">({a.entity_type})</span>
                  </p>
                  <p className="text-xs text-mist-500">{fmtDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
