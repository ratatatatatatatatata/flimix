import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import type { SubscriptionPlan } from "@/types/db";
import { SubscribeClient } from "./SubscribeClient";

export const metadata: Metadata = { title: "Багц сонгох — FLIMIX" };

export default async function SubscribePage() {
  const [session, supabase] = await Promise.all([getSession(), createClient()]);
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("price_mnt", { ascending: true });
  const plans = (data ?? []) as SubscriptionPlan[];

  return (
    <div className="min-h-screen bg-ink-950">
      <div className="container-fx py-12 lg:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            {t.choosePlan}
          </h1>
          <p className="mt-3 text-mist-300">
            Нэг багц — бүх кино, цуврал. Хүссэн үедээ цуцална, үлдсэн хугацаанд
            эрх тань хадгалагдана.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-mist-400">
            <ShieldCheck
              className="h-4 w-4 text-royal-300"
              aria-hidden="true"
            />
            Далд төлбөр, автомат нэмэлт хураамж байхгүй.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          {plans.length === 0 ? (
            <EmptyState
              title="Идэвхтэй багц алга байна"
              description="Багцын мэдээлэл тун удахгүй нэмэгдэнэ. Дараа дахин зочилно уу."
            />
          ) : (
            <SubscribeClient plans={plans} isAuthed={session !== null} />
          )}
        </div>
      </div>
    </div>
  );
}
