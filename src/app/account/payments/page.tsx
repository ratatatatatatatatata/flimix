import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMnt, t } from "@/lib/i18n";
import type { Payment, PaymentProvider, PaymentStatus } from "@/types/db";

const statusLabels: Record<PaymentStatus, string> = {
  pending: "Хүлээгдэж буй",
  paid: "Төлөгдсөн",
  failed: "Амжилтгүй",
  cancelled: "Цуцлагдсан",
  refunded: "Буцаагдсан",
  expired: "Хугацаа дууссан",
};

const statusTones: Record<
  PaymentStatus,
  "default" | "accent" | "success" | "warning" | "danger"
> = {
  pending: "warning",
  paid: "success",
  failed: "danger",
  cancelled: "default",
  refunded: "accent",
  expired: "default",
};

const providerLabels: Record<PaymentProvider, string> = {
  qpay: "QPay",
  socialpay: "SocialPay",
  bank_transfer: "Банкны шилжүүлэг",
  manual: "Гар бүртгэл",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function PaymentsPage() {
  const session = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const payments = (data ?? []) as Payment[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.paymentHistory}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Сүүлийн 50 гүйлгээ. Баримтын дугаараар лавлагаа авах боломжтой.
        </p>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title="Гүйлгээ алга байна"
          description="Багц идэвхжүүлснээр төлбөрийн түүх энд харагдана."
          action={
            <Link href="/subscribe">
              <Button variant="secondary">{t.choosePlan}</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-ink-600 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-800 text-left text-xs uppercase tracking-wide text-mist-400">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Огноо
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Дүн
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Суваг
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Төлөв
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Баримтын №
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/60 bg-ink-900">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-mist-300">
                      {formatDate(payment.paid_at ?? payment.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {formatMnt(payment.amount_mnt)}
                    </td>
                    <td className="px-4 py-3 text-mist-300">
                      {providerLabels[payment.provider]}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTones[payment.status]}>
                        {statusLabels[payment.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-mist-400">
                      {payment.receipt_number ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked rows */}
          <ul className="space-y-3 md:hidden">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="rounded-xl border border-ink-600 bg-ink-800 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">
                    {formatMnt(payment.amount_mnt)}
                  </p>
                  <Badge tone={statusTones[payment.status]}>
                    {statusLabels[payment.status]}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1 text-xs text-mist-400">
                  <p>Огноо: {formatDate(payment.paid_at ?? payment.created_at)}</p>
                  <p>Суваг: {providerLabels[payment.provider]}</p>
                  <p>Баримтын №: {payment.receipt_number ?? "—"}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
