import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyAndApplyPayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Payment } from "@/types/db";

export const runtime = "nodejs";

const querySchema = z.object({
  payment_id: z.string().uuid().optional(),
});

const bodySchema = z
  .object({
    object_id: z.string().min(1).optional(),
    payment_id: z.string().min(1).optional(),
  })
  .passthrough();

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * QPay calls the callback_url we registered at invoice time; it carries our
 * own payment_id + shared secret in the query string. The payload's status is
 * NEVER trusted — verifyAndApplyPayment re-checks with QPay server-side.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.QPAY_WEBHOOK_SECRET;
  const provided =
    req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-callback-token") ?? "";
  if (!expectedSecret || !secretsMatch(provided, expectedSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = querySchema.safeParse({
    payment_id: req.nextUrl.searchParams.get("payment_id") ?? undefined,
  });
  const rawBody: unknown = await req.json().catch(() => ({}));
  const body = bodySchema.safeParse(rawBody);

  const admin = createAdminClient();
  let paymentId: string | null = query.success ? (query.data.payment_id ?? null) : null;

  if (!paymentId) {
    // Fall back to looking the payment up by the provider-side invoice id.
    const externalId = body.success
      ? (body.data.object_id ?? body.data.payment_id ?? null)
      : null;
    if (!externalId) {
      return NextResponse.json({ error: "payment reference missing" }, { status: 400 });
    }
    const { data } = await admin
      .from("payments")
      .select("id")
      .eq("external_id", externalId)
      .eq("provider", "qpay")
      .maybeSingle();
    paymentId = (data as Pick<Payment, "id"> | null)?.id ?? null;
  }

  if (!paymentId) {
    return NextResponse.json({ error: "payment not found" }, { status: 404 });
  }

  let status = "error";
  try {
    status = await verifyAndApplyPayment(paymentId);
  } catch (err) {
    console.error("qpay webhook: verification failed", err);
  }

  await admin.from("audit_logs").insert({
    actor_id: null,
    action: "webhook.qpay",
    entity_type: "payment",
    entity_id: paymentId,
    details: { result: status },
  });

  // Always 200 once the webhook was authenticated and handled, so QPay does
  // not retry indefinitely; reconciliation polling covers transient failures.
  return NextResponse.json({ received: true, status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

// QPay may invoke callback URLs with GET as well.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
