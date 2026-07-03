"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Landmark, QrCode, Smartphone, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMnt, t } from "@/lib/i18n";
import type { PaymentProvider, SubscriptionPlan } from "@/types/db";
import { startCheckout } from "./actions";

type CheckoutProvider = Extract<
  PaymentProvider,
  "qpay" | "socialpay" | "bank_transfer"
>;

const providers: {
  id: CheckoutProvider;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "qpay",
    label: "QPay",
    hint: "Банкны аппаар QR уншуулж төлнө",
    icon: QrCode,
  },
  {
    id: "socialpay",
    label: "SocialPay",
    hint: "SocialPay аппаар шууд төлнө",
    icon: Smartphone,
  },
  {
    id: "bank_transfer",
    label: "Банкны шилжүүлэг",
    hint: "Дансаар шилжүүлж, гараар баталгаажна",
    icon: Landmark,
  },
];

export function SubscribeClient({
  plans,
  isAuthed,
}: {
  plans: SubscriptionPlan[];
  isAuthed: boolean;
}) {
  const [planId, setPlanId] = useState<string>(plans[0]?.id ?? "");
  const [provider, setProvider] = useState<CheckoutProvider>("qpay");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await startCheckout(
        planId,
        provider,
        promoCode.trim() !== "" ? promoCode.trim() : undefined,
      );
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Plan cards */}
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium uppercase tracking-wide text-mist-400">
          Багц
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const selected = planId === plan.id;
            return (
              <label
                key={plan.id}
                className={`relative block cursor-pointer rounded-2xl border p-5 transition ${
                  selected
                    ? "border-royal-500 bg-royal-700/15 shadow-accent"
                    : "border-ink-600 bg-ink-800 hover:border-royal-500/40"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  checked={selected}
                  onChange={() => setPlanId(plan.id)}
                  className="sr-only"
                />
                <p className="font-semibold text-white">{plan.name_mn}</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {formatMnt(plan.price_mnt)}
                  <span className="text-sm font-normal text-mist-400">
                    {t.perMonth}
                  </span>
                </p>
                {plan.trial_days > 0 ? (
                  <p className="mt-1 text-xs text-royal-300">
                    Эхний {plan.trial_days} хоног үнэгүй туршилт
                  </p>
                ) : null}
                <ul className="mt-4 space-y-2">
                  {plan.features_mn.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-mist-300"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-royal-300"
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-sm text-mist-300">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-royal-300"
                      aria-hidden="true"
                    />
                    {plan.device_limit} төхөөрөмж · {plan.stream_limit} зэрэг
                    үзэлт
                  </li>
                </ul>
                {selected ? (
                  <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-royal-500 text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Payment method */}
      <fieldset>
        <legend className="mb-3 text-sm font-medium uppercase tracking-wide text-mist-400">
          Төлбөрийн хэлбэр
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {providers.map((p) => {
            const selected = provider === p.id;
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                  selected
                    ? "border-royal-500 bg-royal-700/15"
                    : "border-ink-600 bg-ink-800 hover:border-royal-500/40"
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={selected}
                  onChange={() => setProvider(p.id)}
                  className="sr-only"
                />
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    selected
                      ? "bg-royal-700/40 text-royal-300"
                      : "bg-ink-700 text-mist-300"
                  }`}
                >
                  <p.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">
                    {p.label}
                  </span>
                  <span className="block text-xs text-mist-400">{p.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Promo code */}
      <div className="max-w-xs">
        <Input
          label="Промо код (заавал биш)"
          type="text"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="FLIMIX2026"
          maxLength={32}
        />
        <p className="mt-1.5 flex items-center gap-1 text-xs text-mist-500">
          <TicketPercent className="h-3.5 w-3.5" aria-hidden="true" />
          Кодтой бол хөнгөлөлт автоматаар тооцогдоно.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      {isAuthed ? (
        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={planId === ""}
          className="w-full sm:w-auto"
        >
          {t.pay}
        </Button>
      ) : (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <p className="text-sm text-mist-300">
            Багц идэвхжүүлэхийн тулд эхлээд нэвтэрнэ үү.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/login?next=/subscribe">
              <Button type="button">{t.signIn}</Button>
            </Link>
            <Link href="/register?next=/subscribe">
              <Button type="button" variant="secondary">
                {t.signUp}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}
