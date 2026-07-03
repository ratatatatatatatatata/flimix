import "server-only";
import type { Payment } from "@/types/db";
import type {
  AdapterInvoiceContext,
  PaymentProviderAdapter,
  ProviderCheckResult,
  ProviderInvoice,
} from "./types";

/**
 * QPay v2 client (https://developer.qpay.mn).
 * OAuth token fetch -> invoice create -> payment check.
 */

interface QPayConfig {
  baseUrl: string;
  username: string;
  password: string;
  invoiceCode: string;
  callbackUrl: string;
  webhookSecret: string;
}

interface QPayAuthResponse {
  access_token: string;
  expires_in: number;
}

interface QPayDeeplink {
  name: string;
  description?: string;
  link: string;
}

interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text?: string;
  qr_image?: string;
  urls?: QPayDeeplink[];
}

interface QPayCheckRow {
  payment_id: string;
  payment_status: string;
  payment_amount: string | number;
}

interface QPayCheckResponse {
  count: number;
  paid_amount?: number;
  rows?: QPayCheckRow[];
}

function getConfig(): QPayConfig {
  const baseUrl = process.env.QPAY_BASE_URL;
  const username = process.env.QPAY_USERNAME;
  const password = process.env.QPAY_PASSWORD;
  const invoiceCode = process.env.QPAY_INVOICE_CODE;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  const webhookSecret = process.env.QPAY_WEBHOOK_SECRET;
  if (!baseUrl || !username || !password || !invoiceCode || !appUrl || !webhookSecret) {
    throw new Error(
      "QPay not configured: set QPAY_BASE_URL, QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE, QPAY_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL",
    );
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    username,
    password,
    invoiceCode,
    callbackUrl: `${appUrl.replace(/\/$/, "")}/api/payments/qpay/webhook`,
    webhookSecret,
  };
}

/** Module-level token cache; QPay tokens live ~24h. */
let cachedToken: { token: string; expiresAtMs: number } | null = null;

async function getAccessToken(config: QPayConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const basic = Buffer.from(`${config.username}:${config.password}`).toString("base64");
  const res = await fetch(`${config.baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`QPay auth failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as QPayAuthResponse;
  cachedToken = {
    token: data.access_token,
    expiresAtMs: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function qpayFetch<T>(
  config: QPayConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await getAccessToken(config);
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`QPay request ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const qpayAdapter: PaymentProviderAdapter = {
  provider: "qpay",

  async createInvoice(ctx: AdapterInvoiceContext): Promise<ProviderInvoice> {
    const config = getConfig();
    const { payment } = ctx;
    const callbackUrl = `${config.callbackUrl}?payment_id=${payment.id}&secret=${encodeURIComponent(config.webhookSecret)}`;

    const invoice = await qpayFetch<QPayInvoiceResponse>(config, "/v2/invoice", {
      invoice_code: config.invoiceCode,
      sender_invoice_no: payment.id,
      invoice_receiver_code: payment.user_id,
      invoice_description: ctx.description,
      amount: payment.amount_mnt,
      callback_url: callbackUrl,
    });

    return {
      externalId: invoice.invoice_id,
      qrText: invoice.qr_text,
      deeplinks: (invoice.urls ?? []).map((u) => ({ name: u.name, link: u.link })),
      raw: { invoice_id: invoice.invoice_id, qr_image: invoice.qr_image ?? null },
    };
  },

  async checkPayment(payment: Payment): Promise<ProviderCheckResult> {
    const config = getConfig();
    if (!payment.external_id) {
      return { status: payment.status, raw: { reason: "missing external_id" } };
    }
    const check = await qpayFetch<QPayCheckResponse>(config, "/v2/payment/check", {
      object_type: "INVOICE",
      object_id: payment.external_id,
      offset: { page_number: 1, page_limit: 100 },
    });

    const rows = check.rows ?? [];
    const paidSum = rows
      .filter((r) => r.payment_status === "PAID")
      .reduce((sum, r) => sum + Number(r.payment_amount), 0);

    const status = paidSum >= payment.amount_mnt ? "paid" : payment.status;
    return {
      status,
      raw: { count: check.count, paid_amount: check.paid_amount ?? paidSum },
    };
  },
};
