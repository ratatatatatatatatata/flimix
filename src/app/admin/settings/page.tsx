import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantRole, revokeRole } from "../users/actions";
import { MessageBanner } from "../_components/MessageBanner";
import { roleLabel, fmtDate } from "../_lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { UserRole } from "@/types/db";

export const dynamic = "force-dynamic";

/** Env presence check ONLY — values are never rendered anywhere. */
function envPresent(...names: string[]): boolean {
  return names.some((n) => Boolean(process.env[n] && String(process.env[n]).length > 0));
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireRole("super_admin");
  const sp = await searchParams;
  const db = createAdminClient();

  const { data: roleRows } = await db
    .from("user_roles")
    .select("user_id,role,created_at")
    .in("role", ["content_manager", "admin", "super_admin"])
    .order("created_at");
  const rows = (roleRows ?? []) as { user_id: string; role: UserRole; created_at: string }[];

  const byUser = new Map<string, { roles: UserRole[]; since: string }>();
  for (const r of rows) {
    const cur = byUser.get(r.user_id);
    if (cur) cur.roles.push(r.role);
    else byUser.set(r.user_id, { roles: [r.role], since: r.created_at });
  }

  const emailByUser = new Map<string, string>();
  await Promise.all(
    [...byUser.keys()].slice(0, 50).map(async (id) => {
      const { data: u } = await db.auth.admin.getUserById(id);
      if (u?.user?.email) emailByUser.set(id, u.user.email);
    }),
  );

  const integrations: { name: string; ok: boolean; envHint: string }[] = [
    { name: "QPay", ok: envPresent("QPAY_CLIENT_ID", "QPAY_USERNAME", "QPAY_MERCHANT_CODE"), envHint: "QPAY_*" },
    { name: "SocialPay", ok: envPresent("SOCIALPAY_MERCHANT_ID", "SOCIALPAY_TERMINAL", "SOCIALPAY_KEY"), envHint: "SOCIALPAY_*" },
    { name: "Bunny CDN", ok: envPresent("BUNNY_API_KEY", "BUNNY_TOKEN_AUTH_KEY", "BUNNY_CDN_HOST"), envHint: "BUNNY_*" },
    { name: "Supabase Service Role", ok: envPresent("SUPABASE_SERVICE_ROLE_KEY"), envHint: "SUPABASE_SERVICE_ROLE_KEY" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
      <h1 className="text-2xl font-semibold text-white">Тохиргоо</h1>
      <MessageBanner message={sp.message} error={sp.error} />

      <section className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="text-lg font-medium text-white">Админ хэрэглэгчид</h2>
        {byUser.size === 0 ? (
          <EmptyState title="Админ эрхтэй хэрэглэгч алга" />
        ) : (
          <ul className="space-y-2">
            {[...byUser.entries()].map(([userId, info]) => {
              const isSuper = info.roles.includes("super_admin");
              return (
                <li key={userId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-900/60 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/users/${userId}`} className="text-sm text-mist-100 hover:text-royal-300">
                      {emailByUser.get(userId) ?? `${userId.slice(0, 8)}…`}
                    </Link>
                    {info.roles.map((r) => (
                      <Badge key={r} tone={r === "super_admin" ? "danger" : r === "admin" ? "accent" : "default"}>
                        {roleLabel[r]}
                      </Badge>
                    ))}
                    <span className="text-xs text-mist-500">эрх олгосон: {fmtDate(info.since)}</span>
                  </span>
                  {isSuper ? (
                    <span className="text-xs text-amber-300">Өөрчлөх боломжгүй</span>
                  ) : (
                    <span className="flex gap-2">
                      {(["content_manager", "admin"] as const).map((r) => {
                        const has = info.roles.includes(r);
                        return (
                          <form key={r} action={has ? revokeRole : grantRole}>
                            <input type="hidden" name="user_id" value={userId} />
                            <input type="hidden" name="role" value={r} />
                            <input type="hidden" name="return" value="/admin/settings" />
                            <Button type="submit" size="sm" variant={has ? "danger" : "secondary"}>
                              {roleLabel[r]} {has ? "хураах" : "олгох"}
                            </Button>
                          </form>
                        );
                      })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-mist-500">
          Шинэ хүнд эрх олгохдоо Хэрэглэгчид хэсгээс тухайн хэрэглэгчийг олж, дэлгэрэнгүй хуудаснаас нь олгоно.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="text-lg font-medium text-white">Интеграцийн төлөв</h2>
        <ul className="space-y-2">
          {integrations.map((i) => (
            <li key={i.name} className="flex items-center justify-between rounded-lg bg-ink-900/60 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-mist-100">
                {i.ok ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden />
                )}
                {i.name}
                <span className="font-mono text-xs text-mist-500">({i.envHint})</span>
              </span>
              <Badge tone={i.ok ? "success" : "warning"}>{i.ok ? "Тохируулагдсан" : "Тохируулаагүй"}</Badge>
            </li>
          ))}
        </ul>
        <p className="text-xs text-mist-500">
          Зөвхөн орчны хувьсагч байгаа эсэхийг шалгана — утга хэзээ ч дэлгэц дээр гарахгүй.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="text-lg font-medium text-white">Аюулгүй байдлын тэмдэглэл</h2>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-mist-400">
          <li>Админы бүх мутаци requireRole шалгалт + zod валидаци + аудит логтой (runAdminAction).</li>
          <li>Service role түлхүүр зөвхөн сервер талд, эрхийн шалгалтын ДАРАА ашиглагдана.</li>
          <li>Супер админ бүртгэлүүдийг интерфэйсээс өөрчлөх боломжгүй.</li>
          <li>Нууц үг хэзээ ч харагдахгүй, өөрчлөгдөхгүй — сэргээлт зөвхөн хэрэглэгчийн имэйлээр.</li>
          <li>Гэрээний баримтууд хаалттай bucket-д, түр гарын үсэгтэй URL-ээр нээгдэнэ.</li>
          <li>Төлбөрийн төлөв зөвхөн сервер талын webhook/шалгалтаас өөрчлөгдөнө.</li>
        </ul>
      </section>
    </div>
  );
}
