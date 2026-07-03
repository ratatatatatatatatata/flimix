import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBanner } from "../_components/MessageBanner";
import { Pagination } from "../_components/Pagination";
import {
  roleLabel,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  fmtDate,
} from "../_lib/format";
import Link from "next/link";
import { Search } from "lucide-react";
import type { SubscriptionStatus, UserRole } from "@/types/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface UserListRow {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  roles: UserRole[];
  subscription: SubscriptionStatus | null;
  banned: boolean;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; message?: string; error?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const db = createAdminClient();

  // Auth users are the source of truth for email; profiles add display names.
  const { data: usersPage } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUsers = usersPage?.users ?? [];
  const ids = authUsers.map((u) => u.id);

  const [profilesRes, rolesRes, subsRes] = await Promise.all([
    ids.length
      ? db.from("profiles").select("user_id,display_name").in("user_id", ids)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
    ids.length
      ? db.from("user_roles").select("user_id,role").in("user_id", ids)
      : Promise.resolve({ data: [] as { user_id: string; role: UserRole }[] }),
    ids.length
      ? db
          .from("subscriptions")
          .select("user_id,status,current_period_end")
          .in("user_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { user_id: string; status: SubscriptionStatus; current_period_end: string }[] }),
  ]);

  const nameByUser = new Map(
    ((profilesRes.data ?? []) as { user_id: string; display_name: string }[]).map((p) => [p.user_id, p.display_name]),
  );
  const rolesByUser = new Map<string, UserRole[]>();
  for (const r of (rolesRes.data ?? []) as { user_id: string; role: UserRole }[]) {
    rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
  }
  const subByUser = new Map<string, SubscriptionStatus>();
  for (const s of (subsRes.data ?? []) as { user_id: string; status: SubscriptionStatus }[]) {
    if (!subByUser.has(s.user_id)) subByUser.set(s.user_id, s.status);
  }

  let rows: UserListRow[] = authUsers.map((u) => {
    const banned = "banned_until" in u && Boolean((u as { banned_until?: string | null }).banned_until);
    return {
      id: u.id,
      email: u.email ?? "(имэйлгүй)",
      displayName: nameByUser.get(u.id) ?? "—",
      createdAt: u.created_at,
      roles: rolesByUser.get(u.id) ?? [],
      subscription: subByUser.get(u.id) ?? null,
      banned,
    };
  });

  if (q) {
    rows = rows.filter(
      (r) => r.email.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q),
    );
  }
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold text-white">Хэрэглэгчид</h1>
      <MessageBanner message={sp.message} error={sp.error} />

      <form method="GET" className="flex flex-wrap items-center gap-3" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Имэйл эсвэл нэрээр хайх..."
            aria-label="Имэйл эсвэл нэрээр хайх"
            className="w-full rounded-lg border border-ink-600 bg-ink-800 py-2 pl-9 pr-4 text-sm text-mist-100 placeholder:text-mist-500 focus:border-royal-500"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">Хайх</Button>
      </form>

      {pageRows.length === 0 ? (
        <EmptyState title="Хэрэглэгч олдсонгүй" description={q ? `"${q}" хайлтад тохирох хэрэглэгч алга.` : "Бүртгэлтэй хэрэглэгч алга."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-600">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-mist-500">
              <tr>
                <th className="px-4 py-3">Имэйл</th>
                <th className="px-4 py-3">Нэр</th>
                <th className="px-4 py-3">Эрхүүд</th>
                <th className="px-4 py-3">Багц</th>
                <th className="px-4 py-3">Бүртгүүлсэн</th>
                <th className="px-4 py-3 text-right">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 bg-ink-800/60">
              {pageRows.map((u) => (
                <tr key={u.id} className="hover:bg-ink-800">
                  <td className="px-4 py-2">
                    <span className="text-mist-100">{u.email}</span>
                    {u.banned ? (
                      <span className="ml-2">
                        <Badge tone="danger">Түдгэлзүүлсэн</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-mist-300">{u.displayName}</td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <Badge>Хэрэглэгч</Badge>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r} tone={r === "super_admin" ? "danger" : r === "admin" ? "accent" : "default"}>
                            {roleLabel[r]}
                          </Badge>
                        ))
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {u.subscription ? (
                      <Badge tone={subscriptionStatusTone[u.subscription]}>
                        {subscriptionStatusLabel[u.subscription]}
                      </Badge>
                    ) : (
                      <span className="text-mist-500">Байхгүй</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-mist-400">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 hover:border-royal-500/60 hover:text-white"
                    >
                      Дэлгэрэнгүй
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/users" params={sp.q ? { q: sp.q } : {}} />
      <p className="text-xs text-mist-600">Нууц үг энд хэзээ ч харагдахгүй, өөрчлөгдөхгүй. Нууц үг сэргээлт зөвхөн хэрэглэгчийн имэйлээр хийгдэнэ.</p>
    </div>
  );
}
