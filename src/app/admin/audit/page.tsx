import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Pagination } from "../_components/Pagination";
import { fmtDateTime } from "../_lib/format";
import type { AuditLog } from "@/types/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; actor?: string; page?: string }>;
}) {
  await requireRole("super_admin");
  const sp = await searchParams;
  const action = (sp.action ?? "").trim();
  const entity = (sp.entity ?? "").trim();
  const actor = (sp.actor ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const db = createAdminClient();
  let query = db
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (action) query = query.ilike("action", `%${action.replace(/[%_]/g, "")}%`);
  if (entity) query = query.ilike("entity_type", `%${entity.replace(/[%_]/g, "")}%`);
  if (actor) query = query.eq("actor_id", actor);

  const { data, count } = await query;
  const logs = (data ?? []) as AuditLog[];

  // Resolve actor emails for display.
  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter((x): x is string => Boolean(x)))];
  const emailByActor = new Map<string, string>();
  await Promise.all(
    actorIds.slice(0, 30).map(async (id) => {
      const { data: u } = await db.auth.admin.getUserById(id);
      if (u?.user?.email) emailByActor.set(id, u.user.email);
    }),
  );

  const params: Record<string, string> = {};
  if (action) params.action = action;
  if (entity) params.entity = entity;
  if (actor) params.actor = actor;

  const inputCls =
    "rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500 focus:border-royal-500";

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold text-white">Аудит лог</h1>

      <form method="GET" className="flex flex-wrap items-center gap-3">
        <input type="text" name="action" defaultValue={action} placeholder="Үйлдэл (жнь: movie.save)" aria-label="Үйлдлээр шүүх" className={inputCls} />
        <input type="text" name="entity" defaultValue={entity} placeholder="Обьектын төрөл (жнь: movie)" aria-label="Обьектын төрлөөр шүүх" className={inputCls} />
        <input type="text" name="actor" defaultValue={actor} placeholder="Гүйцэтгэгчийн ID (UUID)" aria-label="Гүйцэтгэгчээр шүүх" className={`${inputCls} w-80`} />
        <Button type="submit" variant="secondary" size="sm">Шүүх</Button>
      </form>

      {logs.length === 0 ? (
        <EmptyState title="Бичилт олдсонгүй" description="Шүүлтүүрт тохирох аудит бичилт алга." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-600">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-mist-500">
              <tr>
                <th className="px-4 py-3">Огноо</th>
                <th className="px-4 py-3">Гүйцэтгэгч</th>
                <th className="px-4 py-3">Үйлдэл</th>
                <th className="px-4 py-3">Обьект</th>
                <th className="px-4 py-3">Дэлгэрэнгүй</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-800/60">
              {logs.map((l) => (
                <tr key={l.id} className="align-top hover:bg-ink-800">
                  <td className="whitespace-nowrap px-4 py-2 text-mist-400">{fmtDateTime(l.created_at)}</td>
                  <td className="px-4 py-2 text-mist-300">
                    {l.actor_id ? (emailByActor.get(l.actor_id) ?? `${l.actor_id.slice(0, 8)}…`) : "систем"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-royal-300">{l.action}</td>
                  <td className="px-4 py-2 text-mist-300">
                    {l.entity_type}
                    {l.entity_id ? <span className="ml-1 text-xs text-mist-500">{l.entity_id.slice(0, 12)}…</span> : null}
                  </td>
                  <td className="max-w-md px-4 py-2">
                    {l.details ? (
                      <code className="block truncate font-mono text-xs text-mist-400" title={JSON.stringify(l.details)}>
                        {JSON.stringify(l.details)}
                      </code>
                    ) : (
                      <span className="text-mist-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/admin/audit" params={params} />
    </div>
  );
}
