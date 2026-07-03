import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyAndApplyPayment } from "@/lib/payments";
import { socialPayChecksum } from "@/lib/payments/socialpay";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Payment } from "@/types/db";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    invoice: z.string().min(1),
    terminal: z.string().min(1),
    amount: z.union([z.string(), z.number()]),
    checksum: z.string().min(1),
  })
  .passthrough();

function checksumsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a.toLowerCase());
  const bufB = Buffer.from(b.toLowerCase());
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * SocialPay payment notification. The checksum is recomputed with our merchant
 * key (HMAC-SHA256 over terminal+invoice+amount); the payload's status field
 * is NEVER trusted — verifyAndApplyPayment re-checks with SocialPay itself.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const key = process.env.SOCIALPAY_KEY;
  const expectedTerminal = process.env.SOCIALPAY_TERMINAL;
  if (!key || !expectedTerminal) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const { invoice, terminal, amount, checksum } = parsed.data;

  const amountText =
    typeof amount === "number" ? amount.toFixed(2) : amount;
  const expected = socialPayChecksum(key, terminal, invoice, amountText);
  if (terminal !== expectedTerminal || !checksumsMatch(checksum, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("payments")
    .select("id")
    .eq("external_id", invoice)
    .eq("provider", "socialpay")
    .maybeSingle();
  const paymentId = (data as Pick<Payment, "id"> | null)?.id ?? null;
  if (!paymentId) {
    return NextResponse.json({ error: "payment not found" }, { status: 404 });
  }

  let status = "error";
  try {
    status = await verifyAndApplyPayment(paymentId);
  } catch (err) {
    console.error("socialpay webhook: verification failed", err);
  }

  await admin.from("audit_logs").insert({
    actor_id: null,
    action: "webhook.socialpay",
    entity_type: "payment",
    entity_id: paymentId,
    details: { result: status },
  });

  return NextResponse.json({ received: true, status });
}
