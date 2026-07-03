"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

/**
 * Marks the subscription cancelled. Access is kept until
 * current_period_end — no rows are deleted, no refunds triggered here.
 */
export async function cancelSubscription(formData: FormData): Promise<void> {
  const session = await requireUser();
  const id = idSchema.safeParse(formData.get("subscription_id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("user_id", session.userId)
    .in("status", ["active", "trial"]);
  revalidatePath("/account/subscription");
  revalidatePath("/account");
}
