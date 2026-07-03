"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createInvoice, verifyAndApplyPayment } from "@/lib/payments";
import type { PaymentProvider, PaymentStatus } from "@/types/db";

const checkoutSchema = z.object({
  planId: z.string().uuid(),
  provider: z.enum(["qpay", "socialpay", "bank_transfer"]),
  promoCode: z
    .string()
    .trim()
    .min(2, "Промо код хэт богино байна")
    .max(32, "Промо код хэт урт байна")
    .optional(),
});

export interface CheckoutError {
  error: string;
}

/** Short-lived cookie that carries the provider invoice payload to the pay page. */
function invoiceCookieName(paymentId: string): string {
  return `flimix_inv_${paymentId}`;
}

/**
 * Starts a subscription checkout: validates input, delegates invoice
 * creation to @/lib/payments and redirects to the payment status page.
 */
export async function startCheckout(
  planId: string,
  provider: PaymentProvider,
  promoCode?: string,
): Promise<CheckoutError | undefined> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/subscribe")}`);
  }

  const parsed = checkoutSchema.safeParse({
    planId,
    provider,
    promoCode: promoCode && promoCode.trim() !== "" ? promoCode : undefined,
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Буруу утга байна. Шалгана уу.",
    };
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("id", parsed.data.planId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return { error: "Сонгосон багц олдсонгүй эсвэл идэвхгүй байна." };

  let invoice;
  try {
    invoice = await createInvoice({
      userId: session.userId,
      planId: parsed.data.planId,
      provider: parsed.data.provider,
      promoCode: parsed.data.promoCode,
    });
  } catch {
    return { error: "Нэхэмжлэх үүсгэхэд алдаа гарлаа. Дахин оролдоно уу." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    invoiceCookieName(invoice.paymentId),
    JSON.stringify({
      checkoutUrl: invoice.checkoutUrl ?? null,
      qrText: invoice.qrText ?? null,
      deeplinks: invoice.deeplinks ?? [],
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/subscribe",
      maxAge: 60 * 30,
    },
  );

  redirect(`/subscribe/pay/${invoice.paymentId}`);
}

/**
 * Polled by the pay screen. Re-verifies with the provider through
 * @/lib/payments (idempotent) after an ownership check.
 */
export async function checkPaymentStatus(
  paymentId: string,
): Promise<PaymentStatus> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const id = z.string().uuid().safeParse(paymentId);
  if (!id.success) throw new Error("UNAUTHORIZED");

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, status")
    .eq("id", id.data)
    .maybeSingle();
  if (!payment || payment.user_id !== session.userId) {
    throw new Error("UNAUTHORIZED");
  }
  if (payment.status !== "pending") {
    return payment.status as PaymentStatus;
  }
  return verifyAndApplyPayment(id.data);
}
