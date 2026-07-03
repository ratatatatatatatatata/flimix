"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Landmark,
  QrCode,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatMnt, t } from "@/lib/i18n";
import type { PaymentProvider, PaymentStatus } from "@/types/db";
import { checkPaymentStatus } from "../../actions";

export interface PaymentInfo {
  id: string;
  provider: PaymentProvider;
  amountMnt: number;
  initialStatus: PaymentStatus;
  receiptNumber: string | null;
}

export interface InvoiceInfo {
  checkoutUrl: string | null;
  qrText: string | null;
  deeplinks: { name: string; link: string }[];
}

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const providerLabels: Record<PaymentProvider, string> = {
  qpay: "QPay",
  socialpay: "SocialPay",
  bank_transfer: "Банкны шилжүүлэг",
  manual: "Гар бүртгэл",
};

export function PayClient({
  payment,
  invoice,
}: {
  payment: PaymentInfo;
  invoice: InvoiceInfo | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>(payment.initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [copied, setCopied] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (status !== "pending") return;
    const interval = setInterval(async () => {
      if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
        setTimedOut(true);
        clearInterval(interval);
        return;
      }
      try {
        const next = await checkPaymentStatus(payment.id);
        setPollError(false);
        if (next !== "pending") {
          setStatus(next);
          clearInterval(interval);
          if (next === "paid") router.refresh();
        }
      } catch {
        setPollError(true);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, payment.id, router]);

  async function copyQr() {
    if (!invoice?.qrText) return;
    try {
      await navigator.clipboard.writeText(invoice.qrText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const reference = payment.receiptNumber ?? payment.id.slice(0, 8).toUpperCase();

  // --- Terminal states -----------------------------------------------------

  if (status === "paid") {
    return (
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-emerald-700/40 bg-ink-900 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900/40">
          <CheckCircle2
            className="h-8 w-8 text-emerald-300"
            aria-hidden="true"
          />
        </div>
        <h1 className="text-2xl font-bold text-white">{t.paymentPaid}</h1>
        <p className="text-sm text-mist-300">
          Багц тань идэвхжлээ. Сайхан үзвэр хүсье!
        </p>
        <p className="text-xs text-mist-500">Баримтын №: {reference}</p>
        <Link href="/" className="block">
          <Button size="lg" className="w-full">
            {t.watchNow}
          </Button>
        </Link>
      </div>
    );
  }

  if (
    status === "failed" ||
    status === "expired" ||
    status === "cancelled" ||
    status === "refunded" ||
    timedOut
  ) {
    return (
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-red-500/30 bg-ink-900 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-900/40">
          <XCircle className="h-8 w-8 text-red-300" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          {timedOut ? "Хугацаа дууслаа" : t.paymentFailed}
        </h1>
        <p className="text-sm text-mist-300">
          {timedOut
            ? "Төлбөр 5 минутын дотор баталгаажсангүй. Хэрэв та төлбөрөө хийсэн бол түр хүлээгээд хуудсыг сэргээнэ үү — эсвэл дахин эхлүүлээрэй."
            : "Төлбөр амжилтгүй боллоо. Дахин оролдоно уу — таны данснаас мөнгө хасагдсан бол автоматаар буцаагдана."}
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/subscribe" className="block">
            <Button className="w-full">{t.retry}</Button>
          </Link>
          {timedOut ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Хуудас сэргээх
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  // --- Pending state -------------------------------------------------------

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-ink-600 bg-ink-900 p-6 sm:p-8">
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">{t.paymentPending}</h1>
        <p className="mt-1 text-sm text-mist-400">
          {providerLabels[payment.provider]} ·{" "}
          <span className="font-semibold text-white">
            {formatMnt(payment.amountMnt)}
          </span>
        </p>
      </div>

      {payment.provider === "bank_transfer" ? (
        <div className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Landmark className="h-4 w-4 text-royal-300" aria-hidden="true" />
            Шилжүүлгийн заавар
          </div>
          {invoice?.qrText ? (
            <pre className="whitespace-pre-wrap break-all rounded-lg bg-ink-900 p-3 text-xs text-mist-300">
              {invoice.qrText}
            </pre>
          ) : null}
          <ul className="space-y-1.5 text-sm text-mist-300">
            <li>
              Дүн:{" "}
              <span className="font-medium text-white">
                {formatMnt(payment.amountMnt)}
              </span>
            </li>
            <li>
              Гүйлгээний утга:{" "}
              <span className="font-mono font-medium text-royal-300">
                {reference}
              </span>
            </li>
          </ul>
          <p className="text-xs text-mist-500">
            Гүйлгээний утгыг заавал бичнэ үү — төлбөрийг таны бүртгэлтэй
            холбоход ашиглагдана. Шилжүүлэг баталгаажихад хэдэн минут
            зарцуулагдаж болно.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoice?.checkoutUrl ? (
            <a
              href={invoice.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button type="button" className="w-full" size="lg">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Төлбөрийн хуудас нээх
              </Button>
            </a>
          ) : null}

          {invoice?.qrText ? (
            <div className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <QrCode className="h-4 w-4 text-royal-300" aria-hidden="true" />
                QR кодоор төлөх
              </div>
              <p className="text-xs text-mist-400">
                Банкны аппаа нээгээд QR уншуулах хэсэгт доорх кодыг буулгана
                уу, эсвэл доорх апп-уудаас сонгож шууд төлөөрэй.
              </p>
              <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-ink-900 p-3 font-mono text-xs text-mist-300">
                {invoice.qrText}
              </pre>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={copyQr}
                className="w-full"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied ? "Хуулагдлаа!" : "Код хуулах"}
              </Button>
            </div>
          ) : null}

          {invoice && invoice.deeplinks.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {invoice.deeplinks.map((dl) => (
                <a
                  key={dl.link}
                  href={dl.link}
                  className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-center text-sm text-mist-100 transition hover:border-royal-500/50 hover:text-white"
                >
                  {dl.name}
                </a>
              ))}
            </div>
          ) : null}

          {!invoice ? (
            <div className="rounded-xl border border-amber-700/40 bg-amber-900/15 p-4 text-sm text-amber-200">
              Нэхэмжлэхийн мэдээлэл олдсонгүй (хуудас дахин ачаалагдсан байж
              магадгүй). Төлбөрөө аль хэдийн хийсэн бол төлөв автоматаар
              шинэчлэгдэнэ. Үгүй бол{" "}
              <Link href="/subscribe" className="font-medium underline">
                дахин эхлүүлнэ үү
              </Link>
              .
            </div>
          ) : null}
        </div>
      )}

      <div
        className="flex items-center justify-center gap-3 rounded-xl bg-ink-800 px-4 py-3"
        role="status"
      >
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-royal-500/30 border-t-royal-500"
          aria-hidden="true"
        />
        <p className="text-sm text-mist-300">
          Төлбөрийг шалгаж байна... Төлсний дараа энэ хуудас автоматаар
          шинэчлэгдэнэ.
        </p>
      </div>

      {pollError ? (
        <p className="text-center text-xs text-amber-300">
          Төлөв шалгахад түр саатал гарлаа — дахин оролдож байна.
        </p>
      ) : null}

      <p className="text-center text-xs text-mist-500">
        Баримтын №: {reference} · Асуудал гарвал support@flimix.mn
      </p>
    </div>
  );
}
