import type {
  ContentStatus,
  PaymentStatus,
  SubscriptionStatus,
  RightsApprovalStatus,
  UserRole,
} from "@/types/db";

type BadgeTone = "default" | "accent" | "success" | "warning" | "danger";

export const contentStatusLabel: Record<ContentStatus, string> = {
  draft: "Ноорог",
  scheduled: "Товлогдсон",
  published: "Нийтлэгдсэн",
  unpublished: "Буцаагдсан",
  archived: "Архивлагдсан",
};

export const contentStatusTone: Record<ContentStatus, BadgeTone> = {
  draft: "default",
  scheduled: "accent",
  published: "success",
  unpublished: "warning",
  archived: "danger",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Хүлээгдэж буй",
  paid: "Төлөгдсөн",
  failed: "Амжилтгүй",
  cancelled: "Цуцлагдсан",
  refunded: "Буцаагдсан",
  expired: "Хугацаа дууссан",
};

export const paymentStatusTone: Record<PaymentStatus, BadgeTone> = {
  pending: "accent",
  paid: "success",
  failed: "danger",
  cancelled: "default",
  refunded: "warning",
  expired: "default",
};

export const subscriptionStatusLabel: Record<SubscriptionStatus, string> = {
  trial: "Туршилт",
  active: "Идэвхтэй",
  past_due: "Төлбөр хоцорсон",
  cancelled: "Цуцлагдсан",
  expired: "Дууссан",
};

export const subscriptionStatusTone: Record<SubscriptionStatus, BadgeTone> = {
  trial: "accent",
  active: "success",
  past_due: "warning",
  cancelled: "danger",
  expired: "default",
};

export const rightsStatusLabel: Record<RightsApprovalStatus, string> = {
  pending: "Хүлээгдэж буй",
  approved: "Баталгаажсан",
  rejected: "Татгалзсан",
};

export const rightsStatusTone: Record<RightsApprovalStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export const roleLabel: Record<UserRole, string> = {
  user: "Хэрэглэгч",
  content_manager: "Контент менежер",
  admin: "Админ",
  super_admin: "Супер админ",
};

/** Long totals: 4521600s -> "1,256ц 0м" */
export function humanizeSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h === 0) return `${m}м`;
  return `${h.toLocaleString("en-US")}ц ${m}м`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

export function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/** "2026-07" bucket key */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-07-03" bucket key */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function monthsAgoIso(n: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1)).toISOString();
}

export function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
