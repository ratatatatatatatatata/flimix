"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasRole } from "@/lib/auth";
import { runAdminAction, must, AdminActionError, type AdminDb } from "../_lib/adminAction";
import type { UserRole } from "@/types/db";

function withParam(path: string, key: "message" | "error", value: string): string {
  const [base, qs] = path.split("?");
  const sp = new URLSearchParams(qs ?? "");
  sp.delete("message");
  sp.delete("error");
  sp.set(key, value);
  return `${base}?${sp.toString()}`;
}

async function targetRoles(db: AdminDb, userId: string): Promise<UserRole[]> {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as { role: UserRole }[]).map((r) => r.role);
}

/** Guard shared by every user-management mutation: super_admin accounts are untouchable. */
async function assertTargetModifiable(db: AdminDb, userId: string): Promise<void> {
  const roles = await targetRoles(db, userId);
  if (roles.includes("super_admin")) {
    throw new AdminActionError("Супер админ бүртгэлийг өөрчлөх боломжгүй.");
  }
}

/* ------------------------------------------------------------------ */
/* Role management                                                      */
/* ------------------------------------------------------------------ */

const grantableRole = z.enum(["content_manager", "admin"]);

export async function grantRole(formData: FormData): Promise<void> {
  const userId = z.string().uuid().parse(formData.get("user_id"));
  const back = typeof formData.get("return") === "string" && String(formData.get("return")).startsWith("/admin")
    ? String(formData.get("return"))
    : `/admin/users/${userId}`;

  const result = await runAdminAction<null>(
    "admin",
    "user_role.grant",
    "user",
    async ({ db, session }) => {
      const role = grantableRole.parse(formData.get("role"));
      if (role === "admin" && !hasRole(session, "super_admin")) {
        throw new AdminActionError("Админ эрх олгох эрх зөвхөн супер админд бий.");
      }
      if (userId === session.userId) {
        throw new AdminActionError("Өөрийн эрхийг өөрчлөх боломжгүй.");
      }
      await assertTargetModifiable(db, userId);

      const existing = await targetRoles(db, userId);
      if (existing.includes(role)) {
        throw new AdminActionError("Энэ хэрэглэгчид уг эрх аль хэдийн олгогдсон байна.");
      }
      must(
        await db.from("user_roles").insert({ user_id: userId, role }).select("id").single(),
        "Эрх олгоход алдаа",
      );
      return { data: null, entityId: userId, details: { role } };
    },
  );
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/settings");
  redirect(
    result.ok ? withParam(back, "message", "Эрх олгогдлоо.") : withParam(back, "error", result.error),
  );
}

export async function revokeRole(formData: FormData): Promise<void> {
  const userId = z.string().uuid().parse(formData.get("user_id"));
  const back = typeof formData.get("return") === "string" && String(formData.get("return")).startsWith("/admin")
    ? String(formData.get("return"))
    : `/admin/users/${userId}`;

  const result = await runAdminAction<null>(
    "admin",
    "user_role.revoke",
    "user",
    async ({ db, session }) => {
      const role = grantableRole.parse(formData.get("role"));
      if (role === "admin" && !hasRole(session, "super_admin")) {
        throw new AdminActionError("Админ эрх хураах эрх зөвхөн супер админд бий.");
      }
      if (userId === session.userId) {
        throw new AdminActionError("Өөрийн эрхийг өөрчлөх боломжгүй.");
      }
      await assertTargetModifiable(db, userId);
      const { error } = await db.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) throw new AdminActionError(`Эрх хураахад алдаа: ${error.message}`);
      return { data: null, entityId: userId, details: { role } };
    },
  );
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/settings");
  redirect(
    result.ok ? withParam(back, "message", "Эрх хураагдлаа.") : withParam(back, "error", result.error),
  );
}

/* ------------------------------------------------------------------ */
/* Suspend / restore (auth admin ban)                                   */
/* ------------------------------------------------------------------ */

export async function suspendUser(formData: FormData): Promise<void> {
  const userId = z.string().uuid().parse(formData.get("user_id"));
  const result = await runAdminAction<null>(
    "admin",
    "user.suspend",
    "user",
    async ({ db, session }) => {
      if (userId === session.userId) throw new AdminActionError("Өөрийгөө түдгэлзүүлэх боломжгүй.");
      await assertTargetModifiable(db, userId);
      const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (error) throw new AdminActionError(`Түдгэлзүүлэхэд алдаа: ${error.message}`);
      return { data: null, entityId: userId, details: { ban_duration: "876000h" } };
    },
  );
  revalidatePath(`/admin/users/${userId}`);
  redirect(
    result.ok
      ? withParam(`/admin/users/${userId}`, "message", "Хэрэглэгч түдгэлзүүлэгдлээ.")
      : withParam(`/admin/users/${userId}`, "error", result.error),
  );
}

export async function restoreUser(formData: FormData): Promise<void> {
  const userId = z.string().uuid().parse(formData.get("user_id"));
  const result = await runAdminAction<null>(
    "admin",
    "user.restore",
    "user",
    async ({ db }) => {
      await assertTargetModifiable(db, userId);
      const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (error) throw new AdminActionError(`Сэргээхэд алдаа: ${error.message}`);
      return { data: null, entityId: userId, details: { ban_duration: "none" } };
    },
  );
  revalidatePath(`/admin/users/${userId}`);
  redirect(
    result.ok
      ? withParam(`/admin/users/${userId}`, "message", "Хэрэглэгч сэргээгдлээ.")
      : withParam(`/admin/users/${userId}`, "error", result.error),
  );
}

/* ------------------------------------------------------------------ */
/* Device / session reset                                               */
/* ------------------------------------------------------------------ */

export async function resetDeviceSessions(formData: FormData): Promise<void> {
  const userId = z.string().uuid().parse(formData.get("user_id"));
  const result = await runAdminAction<{ devices: number; sessions: number }>(
    "admin",
    "user.reset_device_sessions",
    "user",
    async ({ db }) => {
      const { count: deviceCount } = await db
        .from("user_devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      const { error: devErr } = await db.from("user_devices").delete().eq("user_id", userId);
      if (devErr) throw new AdminActionError(`Төхөөрөмж устгахад алдаа: ${devErr.message}`);

      const { count: sessionCount } = await db
        .from("watch_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");
      const { error: sesErr } = await db
        .from("watch_sessions")
        .update({ status: "terminated", ended_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "active");
      if (sesErr) throw new AdminActionError(`Сешн дуусгахад алдаа: ${sesErr.message}`);

      return {
        data: { devices: deviceCount ?? 0, sessions: sessionCount ?? 0 },
        entityId: userId,
        details: { devices: deviceCount ?? 0, sessions: sessionCount ?? 0 },
      };
    },
  );
  revalidatePath(`/admin/users/${userId}`);
  redirect(
    result.ok
      ? withParam(
          `/admin/users/${userId}`,
          "message",
          `Төхөөрөмжүүд шинэчлэгдлээ (${result.data.devices} төхөөрөмж, ${result.data.sessions} идэвхтэй сешн).`,
        )
      : withParam(`/admin/users/${userId}`, "error", result.error),
  );
}
