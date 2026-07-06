import Link from "next/link";
import { Check } from "lucide-react";
import { getActivePlans } from "@/lib/catalog";
import { formatMnt, t } from "@/lib/i18n";

const DEFAULT_FEATURES: string[] = [
  "Бүх кино, цувралыг үзэх",
  "Олон төхөөрөмжөөс ашиглах",
  "HD болон Full HD чанар",
  "Англи, Монгол хадмал",
];

interface PlanCardData {
  id: string;
  name: string;
  priceMnt: number;
  periodLabel: string;
  features: string[];
}

function PlanCard({ plan }: { plan: PlanCardData }) {
  return (
    <div className="animated-border w-full max-w-sm rounded-2xl p-8 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-widest text-royal-300">
        {plan.name}
      </p>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold text-white">
          {formatMnt(plan.priceMnt)}
        </span>
        <span className="text-sm text-mist-400">{plan.periodLabel}</span>
      </p>
      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-mist-100">
            <Check size={16} className="mt-0.5 shrink-0 text-royal-400" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href="/subscribe"
        className="btn-glow mt-8 inline-flex w-full items-center justify-center rounded-lg bg-brand-gradient px-6 py-3.5 font-medium text-white shadow-accent transition hover:brightness-110"
      >
        {t.choosePlan}
      </Link>
    </div>
  );
}

/**
 * Landing subscription section — active plans from the cached public helper
 * rendered as animated-border cards. Falls back to the standard monthly plan
 * card when no plans are seeded so the landing CTA never disappears.
 */
export async function PlanSection() {
  const plans = await getActivePlans();
  const cards: PlanCardData[] =
    plans.length > 0
      ? plans.slice(0, 3).map((plan) => ({
          id: plan.id,
          name: plan.name_mn,
          priceMnt: plan.price_mnt,
          periodLabel:
            plan.duration_days <= 31 ? t.perMonth : ` / ${plan.duration_days} хоног`,
          features:
            plan.features_mn && plan.features_mn.length > 0
              ? plan.features_mn
              : DEFAULT_FEATURES,
        }))
      : [
          {
            id: "default-monthly",
            name: t.monthlyPlan,
            priceMnt: 14900,
            periodLabel: t.perMonth,
            features: DEFAULT_FEATURES,
          },
        ];

  return (
    <section aria-labelledby="plan-heading" className="pb-4">
      <h2
        id="plan-heading"
        className="text-center font-display text-2xl font-bold text-white sm:text-3xl"
      >
        Өнөөдөр эхлээрэй
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-mist-300">
        Нэг багц — бүх контент. Хүссэн үедээ нэг товшилтоор цуцална.
      </p>
      <div className="mt-10 flex flex-wrap items-stretch justify-center gap-6">
        {cards.map((card) => (
          <PlanCard key={card.id} plan={card} />
        ))}
      </div>
    </section>
  );
}
