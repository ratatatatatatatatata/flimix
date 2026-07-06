import "server-only";
import { revalidateTag } from "next/cache";
import { requireRole, type SessionInfo } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/db";
import { ZodError } from "zod";

export type AdminDb = ReturnType<typeof createAdminClient>;

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

export interface AdminActionContext {
  db: AdminDb;
  session: SessionInfo;
}

export interface AdminActionOutput<T> {
  data: T;
  /** Primary entity id for the audit trail. */
  entityId?: string | null;
  /** Extra structured info stored in audit_logs.details. */
  details?: Record<string, unknown>;
  /** Optional success message shown to the operator. */
  message?: string;
}

/** Errors thrown intentionally inside admin actions — message is shown verbatim (Mongolian). */
export class AdminActionError extends Error {}

function isNextControlFlowError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("digest" in err)) return false;
  const digest = (err as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

/**
 * MANDATORY wrapper for every admin mutation.
 * 1. Re-checks the caller's role via requireRole (redirects when unauthorized).
 * 2. The action body zod-validates its input (ZodError is converted to a
 *    readable Mongolian error).
 * 3. Hands the service-role client to the body only AFTER the role check.
 * 4. Writes an audit_logs row {actor_id, action, entity_type, entity_id, details}.
 */
export async function runAdminAction<T>(
  minRole: UserRole,
  action: string,
  entityType: string,
  fn: (ctx: AdminActionContext) => Promise<AdminActionOutput<T>>,
): Promise<ActionResult<T>> {
  const session = await requireRole(minRole);
  const db = createAdminClient();
  try {
    const out = await fn({ db, session });
    await db.from("audit_logs").insert({
      actor_id: session.userId,
      action,
      entity_type: entityType,
      entity_id: out.entityId ?? null,
      details: out.details ?? null,
    });
    // Admin mutations may change public catalog data (content, homepage
    // sections, series, rights) — drop the shared "catalog" cache so the
    // public site picks the change up immediately instead of after the
    // 60s revalidate window. Over-invalidating is harmless and cheap.
    revalidateTag("catalog");
    return { ok: true, data: out.data, message: out.message };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const where = first ? first.path.join(".") : "";
      return {
        ok: false,
        error: `Буруу утга (${where}): ${first?.message ?? "шалгаад дахин оруулна уу"}`,
      };
    }
    if (err instanceof AdminActionError) return { ok: false, error: err.message };
    console.error(`[admin:${action}]`, err);
    return { ok: false, error: "Алдаа гарлаа. Дахин оролдоно уу." };
  }
}

/** Throws AdminActionError when a Supabase call failed. */
export function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new AdminActionError(`${what}: ${result.error.message}`);
  if (result.data === null) throw new AdminActionError(`${what}: өгөгдөл олдсонгүй`);
  return result.data;
}
