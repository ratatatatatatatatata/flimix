import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Payment,
  PaymentProvider,
  PaymentStatus,
  PromoCode,
  Subscription,
  SubscriptionPlan,
} from "@/types/db";
import { bankTransferAdapter } from "./bank";
import { qpayAdapter } from "./qpay";
import { socialPayAdapter } from "./socialpay";
import type {
  AttemptMetadata,
  CreateInvoiceInput,
  InvoiceResult,
  PaymentProviderAdapter,
  ProviderInvoice,
} from "./types";

export type {
  AttemptMetadata,
  CreateInvoiceInput,
  InvoiceResult,
  PaymentAttempt,
  PaymentProviderAdapter,
  ProviderCheckResult,
  ProviderInvoice,
} from "./types";

const adapters: Partial<Record<PaymentProvider, PaymentProviderAdapter>> = {
  qpay: qpayAdapter,
  socialpay: socialPayAdapter,
  bank_transfer: bankTransferAdapter,
};

function getAdapter(provider: PaymentProvider): PaymentProviderAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Unsupported payment provider: ${provider}`);
  }
  return adapter;
}

interface ValidPromo {
  promo: PromoCode;
  discountPercent: number;
  bonusDays: number;
}

/** Validates a promo code against activity window and usage cap. */
async function resolvePromo(
  admin: ReturnType<typeof createAdminClient>,
  code: string,
): Promise<ValidPromo | null> {
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from("promo_codes")
    .select("*")
    .ilike("code", code.trim())
    .eq("is_active", true)
    .lte("valid_from", nowIso)
    .maybeSingle();
  const promo = data as PromoCode | null;
  if (!promo) return null;
  if (promo.valid_until !== null && promo.valid_until <= nowIso) return null;
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) return null;
  return {
    promo,
    discountPercent: promo.discount_percent ?? 0,
    bonusDays: promo.bonus_days ?? 0,
  };
}

/**
 * Contract entry point (see docs/CONVENTIONS.md).
 * Creates a pending payments row + payment_attempts row, registers the invoice
 * with the provider and stores its external id.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceResult> {
  const { userId, planId, provider, promoCode } = input;
  const adapter = getAdapter(provider);
  const admin = createAdminClient();

  const { data: planRow, error: planError } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  if (planError) throw new Error(`Plan lookup failed: ${planError.message}`);
  const plan = planRow as SubscriptionPlan | null;
  if (!plan) {
    throw new Error("Багц олдсонгүй эсвэл идэвхгүй байна");
  }

  const applied = promoCode ? await resolvePromo(admin, promoCode) : null;
  const discountPercent = applied?.discountPercent ?? 0;
  const amount = Math.max(
    0,
    Math.round((plan.price_mnt * (100 - discountPercent)) / 100),
  );

  const { data: paymentRow, error: paymentError } = await admin
    .from("payments")
    .insert({
      user_id: userId,
      provider,
      amount_mnt: amount,
      status: "pending" satisfies PaymentStatus,
    })
    .select("*")
    .single();
  if (paymentError) {
    throw new Error(`Payment insert failed: ${paymentError.message}`);
  }
  const payment = paymentRow as Payment;

  const metadata: AttemptMetadata = {
    plan_id: plan.id,
    promo_code_id: applied?.promo.id ?? null,
    bonus_days: applied?.bonusDays ?? 0,
    discount_percent: discountPercent,
  };

  const { data: attemptRow, error: attemptError } = await admin
    .from("payment_attempts")
    .insert({
      payment_id: payment.id,
      provider,
      status: "created",
      request_payload: metadata,
    })
    .select("id")
    .single();
  if (attemptError) {
    throw new Error(`Payment attempt insert failed: ${attemptError.message}`);
  }
  const attemptId = (attemptRow as { id: string }).id;

  let invoice: ProviderInvoice;
  try {
    invoice = await adapter.createInvoice({
      payment,
      plan,
      description: `FLIMIX — ${plan.name_mn}`,
    });
  } catch (err) {
    await admin
      .from("payment_attempts")
      .update({ status: "failed", response_payload: { error: String(err) } })
      .eq("id", attemptId);
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    throw err;
  }

  await admin
    .from("payments")
    .update({ external_id: invoice.externalId })
    .eq("id", payment.id);
  await admin
    .from("payment_attempts")
    .update({
      external_id: invoice.externalId,
      response_payload: invoice.raw ?? {},
    })
    .eq("id", attemptId);

  return {
    paymentId: payment.id,
    checkoutUrl: invoice.checkoutUrl,
    qrText: invoice.qrText,
    deeplinks: invoice.deeplinks,
    instructions: invoice.instructions,
  };
}

/**
 * Rental checkout: creates a pending payment for a single movie. Applied in
 * verifyAndApplyPayment via metadata.movie_id (mirrors the plan flow).
 */
export async function createRentalInvoice(input: {
  userId: string;
  movieId: string;
  provider: PaymentProvider;
}): Promise<InvoiceResult> {
  const { userId, movieId, provider } = input;
  const adapter = getAdapter(provider);
  const admin = createAdminClient();

  const { data: movieRow, error: movieError } = await admin
    .from("movies")
    .select("id, title_mn, rental_price_mnt")
    .eq("id", movieId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (movieError) throw new Error(`Movie lookup failed: ${movieError.message}`);
  const movie = movieRow as
    | { id: string; title_mn: string; rental_price_mnt: number | null }
    | null;
  if (!movie || movie.rental_price_mnt === null || movie.rental_price_mnt <= 0) {
    throw new Error("Энэ кино түрээсээр үзэх боломжгүй байна");
  }

  const { data: paymentRow, error: paymentError } = await admin
    .from("payments")
    .insert({
      user_id: userId,
      provider,
      amount_mnt: movie.rental_price_mnt,
      status: "pending" satisfies PaymentStatus,
    })
    .select("*")
    .single();
  if (paymentError) {
    throw new Error(`Payment insert failed: ${paymentError.message}`);
  }
  const payment = paymentRow as Payment;

  const metadata: AttemptMetadata = {
    plan_id: null,
    movie_id: movie.id,
    promo_code_id: null,
    bonus_days: 0,
    discount_percent: 0,
  };

  const { data: attemptRow, error: attemptError } = await admin
    .from("payment_attempts")
    .insert({
      payment_id: payment.id,
      provider,
      status: "created",
      request_payload: metadata,
    })
    .select("id")
    .single();
  if (attemptError) {
    throw new Error(`Payment attempt insert failed: ${attemptError.message}`);
  }
  const attemptId = (attemptRow as { id: string }).id;

  let invoice: ProviderInvoice;
  try {
    invoice = await adapter.createInvoice({
      payment,
      plan: null,
      description: `FLIMIX түрээс — ${movie.title_mn}`,
    });
  } catch (err) {
    await admin
      .from("payment_attempts")
      .update({ status: "failed", response_payload: { error: String(err) } })
      .eq("id", attemptId);
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    throw err;
  }

  await admin
    .from("payments")
    .update({ external_id: invoice.externalId })
    .eq("id", payment.id);
  await admin
    .from("payment_attempts")
    .update({
      external_id: invoice.externalId,
      response_payload: invoice.raw ?? {},
    })
    .eq("id", attemptId);

  return {
    paymentId: payment.id,
    checkoutUrl: invoice.checkoutUrl,
    qrText: invoice.qrText,
    deeplinks: invoice.deeplinks,
    instructions: invoice.instructions,
  };
}

function buildReceiptNumber(paymentId: string, paidAt: Date): string {
  // FLX-{year}-{short id}: the payment UUID prefix acts as a collision-safe
  // short sequence without needing a dedicated counter table.
  const shortId = paymentId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `FLX-${paidAt.getFullYear()}-${shortId}`;
}

async function loadAttemptMetadata(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
): Promise<AttemptMetadata | null> {
  const { data } = await admin
    .from("payment_attempts")
    .select("request_payload")
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = (data as { request_payload: AttemptMetadata | null } | null)
    ?.request_payload;
  return payload ?? null;
}

/**
 * Contract entry point (see docs/CONVENTIONS.md).
 * Re-checks the payment with the provider server-side (NEVER trusts
 * client/webhook-sent status), and on success — idempotently — marks the
 * payment paid, activates/extends the subscription, consumes the promo code,
 * notifies the user and writes an audit log.
 */
export async function verifyAndApplyPayment(paymentId: string): Promise<PaymentStatus> {
  const admin = createAdminClient();

  const { data: paymentRow, error: paymentError } = await admin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) throw new Error(`Payment lookup failed: ${paymentError.message}`);
  const payment = paymentRow as Payment | null;
  if (!payment) throw new Error("Төлбөрийн бичилт олдсонгүй");

  // Idempotency: already applied.
  if (payment.status === "paid") return "paid";
  if (payment.status === "refunded" || payment.status === "cancelled") {
    return payment.status;
  }

  const adapter = getAdapter(payment.provider);
  const check = await adapter.checkPayment(payment);
  if (check.status !== "paid") {
    if (check.status === "failed" || check.status === "expired") {
      await admin
        .from("payments")
        .update({ status: check.status })
        .eq("id", payment.id)
        .eq("status", "pending");
      return check.status;
    }
    return payment.status;
  }

  const paidAt = new Date();
  // Conditional update doubles as a row lock substitute: only one caller can
  // flip pending -> paid; concurrent verifiers see zero affected rows.
  const { data: flipped, error: flipError } = await admin
    .from("payments")
    .update({
      status: "paid",
      paid_at: paidAt.toISOString(),
      receipt_number: buildReceiptNumber(payment.id, paidAt),
    })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");
  if (flipError) throw new Error(`Payment update failed: ${flipError.message}`);
  if (!flipped || flipped.length === 0) {
    // Another verifier won the race and is applying/has applied the effects.
    return "paid";
  }

  const metadata = await loadAttemptMetadata(admin, payment.id);
  const planId = metadata?.plan_id ?? null;
  const bonusDays = metadata?.bonus_days ?? 0;

  let subscriptionId: string | null = null;
  if (planId) {
    const { data: planRow } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    const plan = planRow as SubscriptionPlan | null;
    if (plan) {
      const totalDays = plan.duration_days + bonusDays;
      const { data: subRow } = await admin
        .from("subscriptions")
        .select("*")
        .eq("user_id", payment.user_id)
        .order("current_period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      const existing = subRow as Subscription | null;

      // Extend from max(now, current end) so remaining time is never lost.
      const base = existing
        ? Math.max(paidAt.getTime(), new Date(existing.current_period_end).getTime())
        : paidAt.getTime();
      const newEnd = new Date(base + totalDays * 24 * 60 * 60 * 1000).toISOString();

      if (existing) {
        await admin
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            status: "active",
            current_period_end: newEnd,
            cancelled_at: null,
          })
          .eq("id", existing.id);
        subscriptionId = existing.id;
      } else {
        const { data: created } = await admin
          .from("subscriptions")
          .insert({
            user_id: payment.user_id,
            plan_id: plan.id,
            status: "active",
            started_at: paidAt.toISOString(),
            current_period_end: newEnd,
          })
          .select("id")
          .single();
        subscriptionId = (created as { id: string } | null)?.id ?? null;
      }

      if (subscriptionId) {
        await admin
          .from("payments")
          .update({ subscription_id: subscriptionId })
          .eq("id", payment.id);
      }
    }
  }

  // Rental checkout: grant a timed movie purchase instead of a subscription.
  const rentalMovieId = metadata?.movie_id ?? null;
  if (rentalMovieId) {
    const { data: movieRow } = await admin
      .from("movies")
      .select("id, rental_hours")
      .eq("id", rentalMovieId)
      .maybeSingle();
    const rentalHours =
      (movieRow as { rental_hours: number | null } | null)?.rental_hours ?? 48;
    await admin.from("movie_purchases").insert({
      user_id: payment.user_id,
      movie_id: rentalMovieId,
      payment_id: payment.id,
      amount_mnt: payment.amount_mnt,
      expires_at: new Date(
        paidAt.getTime() + rentalHours * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  if (metadata?.promo_code_id) {
    const { data: promoRow } = await admin
      .from("promo_codes")
      .select("used_count")
      .eq("id", metadata.promo_code_id)
      .maybeSingle();
    const usedCount = (promoRow as { used_count: number } | null)?.used_count;
    if (typeof usedCount === "number") {
      await admin
        .from("promo_codes")
        .update({ used_count: usedCount + 1 })
        .eq("id", metadata.promo_code_id);
    }
  }

  await admin.from("notifications").insert({
    user_id: payment.user_id,
    title_mn: "Төлбөр амжилттай",
    body_mn: rentalMovieId
      ? "Таны төлбөр баталгаажиж, киноны түрээс идэвхжлээ. Сайхан үзээрэй!"
      : "Таны төлбөр баталгаажиж, багц идэвхжлээ. FLIMIX-ээр сайхан хугацаа өнгөрүүлээрэй!",
    type: "payment",
  });

  await admin.from("audit_logs").insert({
    actor_id: null,
    action: "payment.verified_paid",
    entity_type: "payment",
    entity_id: payment.id,
    details: {
      provider: payment.provider,
      amount_mnt: payment.amount_mnt,
      subscription_id: subscriptionId,
      check: check.raw ?? null,
    },
  });

  return "paid";
}
