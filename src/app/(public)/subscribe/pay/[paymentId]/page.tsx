import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PaymentProvider, PaymentStatus } from "@/types/db";
import { PayClient, type InvoiceInfo, type PaymentInfo } from "./PayClient";

export const metadata: Metadata = { title: "Төлбөр — FLIMIX" };

interface PaymentRow {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  amount_mnt: number;
  status: PaymentStatus;
  receipt_number: string | null;
  created_at: string;
}

const invoiceSchema = z.object({
  checkoutUrl: z.string().url().nullable(),
  qrText: z.string().nullable(),
  deeplinks: z.array(z.object({ name: z.string(), link: z.string() })),
});

export default async function PayPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const idParse = z.string().uuid().safeParse(paymentId);
  if (!idParse.success) notFound();

  const session = await requireUser();
  const supabase = await createClient();

  // Ownership check: the payment must belong to the signed-in user.
  const { data } = await supabase
    .from("payments")
    .select("id, user_id, provider, amount_mnt, status, receipt_number, created_at")
    .eq("id", idParse.data)
    .eq("user_id", session.userId)
    .maybeSingle();
  const paymentRow = (data ?? null) as PaymentRow | null;
  if (!paymentRow) notFound();

  // Provider invoice payload handed over by startCheckout via cookie.
  const cookieStore = await cookies();
  const rawInvoice = cookieStore.get(`flimix_inv_${paymentRow.id}`)?.value;
  let invoice: InvoiceInfo | null = null;
  if (rawInvoice) {
    try {
      const parsed = invoiceSchema.safeParse(JSON.parse(rawInvoice));
      if (parsed.success) invoice = parsed.data;
    } catch {
      invoice = null;
    }
  }

  const payment: PaymentInfo = {
    id: paymentRow.id,
    provider: paymentRow.provider,
    amountMnt: paymentRow.amount_mnt,
    initialStatus: paymentRow.status,
    receiptNumber: paymentRow.receipt_number,
  };

  return (
    <div className="min-h-screen bg-ink-950">
      <div className="container-fx flex justify-center py-12 lg:py-16">
        <PayClient payment={payment} invoice={invoice} />
      </div>
    </div>
  );
}
