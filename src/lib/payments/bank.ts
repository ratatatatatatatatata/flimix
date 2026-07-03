import "server-only";
import type { Payment } from "@/types/db";
import type {
  AdapterInvoiceContext,
  PaymentProviderAdapter,
  ProviderCheckResult,
  ProviderInvoice,
} from "./types";

/**
 * Manual bank-transfer adapter. There is no external API: createInvoice hands
 * back transfer instructions and the payment stays pending until an admin
 * marks it paid (the admin flow updates payments.status directly, after which
 * verifyAndApplyPayment applies the subscription).
 */

function buildInstructions(payment: Payment): string {
  const bankName = process.env.BANK_TRANSFER_BANK_NAME ?? "Хаан банк";
  const accountNumber = process.env.BANK_TRANSFER_ACCOUNT ?? "";
  const accountHolder = process.env.BANK_TRANSFER_HOLDER ?? "FLIMIX LLC";
  const reference = payment.id.slice(0, 8).toUpperCase();
  return [
    `Банк: ${bankName}`,
    accountNumber ? `Дансны дугаар: ${accountNumber}` : null,
    `Хүлээн авагч: ${accountHolder}`,
    `Дүн: ${payment.amount_mnt.toLocaleString("mn-MN")}₮`,
    `Гүйлгээний утга: FLX-${reference}`,
    "Төлбөр баталгаажсаны дараа таны багц идэвхжинэ (ажлын 1 өдрийн дотор).",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export const bankTransferAdapter: PaymentProviderAdapter = {
  provider: "bank_transfer",

  async createInvoice(ctx: AdapterInvoiceContext): Promise<ProviderInvoice> {
    const { payment } = ctx;
    return {
      // No provider-side id exists; reuse the payment id as reference.
      externalId: payment.id,
      instructions: buildInstructions(payment),
      raw: { manual: true },
    };
  },

  async checkPayment(payment: Payment): Promise<ProviderCheckResult> {
    // Source of truth is the DB row an admin updates; report it back verbatim.
    return { status: payment.status, raw: { manual: true } };
  },
};
