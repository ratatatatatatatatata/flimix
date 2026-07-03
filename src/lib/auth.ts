import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/db";
import { redirect } from "next/navigation";

const ROLE_ORDER: Record<UserRole, number> = {
  user: 0,
  content_manager: 1,
  admin: 2,
  super_admin: 3,
};

export interface SessionInfo {
  userId: string;
  email: string | null;
  roles: UserRole[];
}

/** Current authenticated user (server-verified via getUser) or null. */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (roleRows ?? []).map((r) => r.role as UserRole);
  if (roles.length === 0) roles.push("user");

  return { userId: user.id, email: user.email ?? null, roles };
}

export function hasRole(session: SessionInfo, minimum: UserRole): boolean {
  const needed = ROLE_ORDER[minimum];
  return session.roles.some((r) => ROLE_ORDER[r] >= needed);
}

/** Redirects to /login when unauthenticated. */
export async function requireUser(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Redirects when the caller lacks the minimum role. */
export async function requireRole(minimum: UserRole): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session, minimum)) redirect("/");
  return session;
}

/** Does the user have an active (or trial) subscription right now? */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "trial"])
    .gt("current_period_end", new Date().toISOString())
    .limit(1);
  return (data ?? []).length > 0;
}
