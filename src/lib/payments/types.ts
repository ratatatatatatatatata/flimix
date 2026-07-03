import "server-only";
import type {
  Payment,
  PaymentProvider,
  PaymentStatus,
  SubscriptionPlan,
  UUID,
} from "@/types/db";

/** Contract result of createInvoice (see docs/CONVENTIONS.md). */
export interface InvoiceResult {
  paymentId: string; // payments.id
  checkoutUrl?: string; // redirect-style providers
  qrText?: string; // QPay QR content
  deeplinks?: { name: string; link: string }[];
  /** Human-readable payment instructions (bank transfer). Additive optional field. */
  instructions?: string;
}

export interface CreateInvoiceInput {
  userId: string;
  planId: string;
  provider: PaymentProvider;
  promoCode?: string;
}

/** What a provider adapter returns after registering an invoice on its side. */
export interface ProviderInvoice {
  /** Provider-side invoice/transaction id, stored in payments.external_id. */
  externalId: string;
  checkoutUrl?: string;
  qrText?: string;
  deeplinks?: { name: string; link: string }[];
  instructions?: string;
  /** Raw provider response, persisted in payment_attempts for auditing. */
  raw?: Record<string, unknown>;
}

/** What a provider adapter reports when re-checking a payment server-side. */
export interface ProviderCheckResult {
  status: PaymentStatus;
  raw?: Record<string, unknown>;
}

export interface AdapterInvoiceContext {
  payment: Payment;
  plan: SubscriptionPlan;
  description: string;
}

/** Every payment backend implements exactly this surface. */
export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createInvoice(ctx: AdapterInvoiceContext): Promise<ProviderInvoice>;
  checkPayment(payment: Payment): Promise<ProviderCheckResult>;
}

/** Mirror of the payment_attempts table (not part of @/types/db). */
export interface PaymentAttempt {
  id: UUID;
  payment_id: UUID;
  provider: PaymentProvider;
  status: "created" | "checked" | "failed";
  external_id: string | null;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
}

/** Metadata stashed in payment_attempts.request_payload at invoice time. */
export interface AttemptMetadata {
  plan_id: string;
  promo_code_id: string | null;
  bonus_days: number;
  discount_percent: number;
  [key: string]: unknown;
}
