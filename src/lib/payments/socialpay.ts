import "server-only";
import { createHmac } from "node:crypto";
import type { Payment } from "@/types/db";
import type {
  AdapterInvoiceContext,
  PaymentProviderAdapter,
  ProviderCheckResult,
  ProviderInvoice,
} from "./types";

/**
 * SocialPay (Golomt Bank in-store) adapter.
 *
 * Requests carry an HMAC-SHA256 checksum of the concatenated request fields
 * (terminal + invoice + amount) keyed with the merchant secret, per the known
 * SocialPay in-store API pattern.
 *
 * NOTE: field order / endpoint paths must be confirmed against the current
 * SocialPay merchant documentation before production use.
 */

interface SocialPayConfig {
  baseUrl: string;
  terminal: string;
  key: string;
}

interface SocialPayEnvelope {
  header?: { code?: number };
  body?: {
    response?: {
      desc?: string;
      status?: string;
      qr?: string;
      deeplink?: string;
    };
    error?: { errorDesc?: string };
  };
}

function getConfig(): SocialPayConfig {
  const baseUrl = process.env.SOCIALPAY_BASE_URL;
  const terminal = process.env.SOCIALPAY_TERMINAL;
  const key = process.env.SOCIALPAY_KEY;
  if (!baseUrl || !terminal || !key) {
    throw new Error(
      "SocialPay not configured: set SOCIALPAY_BASE_URL, SOCIALPAY_TERMINAL and SOCIALPAY_KEY",
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), terminal, key };
}

export function socialPayChecksum(key: string, ...fields: string[]): string {
  return createHmac("sha256", key).update(fields.join("")).digest("hex");
}

function formatAmount(amountMnt: number): string {
  return amountMnt.toFixed(2);
}

async function socialPayFetch(
  config: SocialPayConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<SocialPayEnvelope> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`SocialPay request ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as SocialPayEnvelope;
}

export const socialPayAdapter: PaymentProviderAdapter = {
  provider: "socialpay",

  async createInvoice(ctx: AdapterInvoiceContext): Promise<ProviderInvoice> {
    const config = getConfig();
    const { payment } = ctx;
    // The payment row id doubles as the SocialPay invoice number.
    const invoice = payment.id;
    const amount = formatAmount(payment.amount_mnt);
    const checksum = socialPayChecksum(config.key, config.terminal, invoice, amount);

    const data = await socialPayFetch(config, "/pos/invoice/qr", {
      amount,
      checksum,
      invoice,
      terminal: config.terminal,
    });

    const response = data.body?.response;
    if (data.body?.error || !response) {
      throw new Error(
        `SocialPay invoice create failed: ${data.body?.error?.errorDesc ?? "unknown error"}`,
      );
    }

    return {
      externalId: invoice,
      qrText: response.qr,
      deeplinks: response.deeplink
        ? [{ name: "SocialPay", link: response.deeplink }]
        : undefined,
      raw: { desc: response.desc ?? null, status: response.status ?? null },
    };
  },

  async checkPayment(payment: Payment): Promise<ProviderCheckResult> {
    const config = getConfig();
    const invoice = payment.external_id ?? payment.id;
    const amount = formatAmount(payment.amount_mnt);
    const checksum = socialPayChecksum(config.key, config.terminal, invoice, amount);

    const data = await socialPayFetch(config, "/pos/invoice/check", {
      amount,
      checksum,
      invoice,
      terminal: config.terminal,
    });

    const status = data.body?.response?.status?.toUpperCase() ?? "";
    return {
      status: status === "PAID" || status === "SUCCESS" ? "paid" : payment.status,
      raw: { provider_status: status || null },
    };
  },
};
