"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function removeDevice(formData: FormData): Promise<void> {
  const session = await requireUser();
  const id = idSchema.safeParse(formData.get("device_id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("user_devices")
    .delete()
    .eq("id", id.data)
    .eq("user_id", session.userId);
  revalidatePath("/account/devices");
}

/** Removes every registered device and revokes ALL sessions globally. */
export async function signOutAllDevices(): Promise<void> {
  const session = await requireUser();
  const supabase = await createClient();
  await supabase.from("user_devices").delete().eq("user_id", session.userId);
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
