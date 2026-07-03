"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function removeFavorite(formData: FormData): Promise<void> {
  const session = await requireUser();
  const id = idSchema.safeParse(formData.get("favorite_id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("favorites")
    .delete()
    .eq("id", id.data)
    .eq("user_id", session.userId);
  revalidatePath("/account/favorites");
}
