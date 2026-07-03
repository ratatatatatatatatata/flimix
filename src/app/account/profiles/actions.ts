"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MAX_PROFILES = 5;

const nameSchema = z
  .string()
  .trim()
  .min(1, "Нэр оруулна уу")
  .max(40, "Нэр хэт урт байна");

const idSchema = z.string().uuid();

function fail(code: string): never {
  redirect(`/account/profiles?error=${code}`);
}

export async function createProfile(formData: FormData): Promise<void> {
  const session = await requireUser();
  const name = nameSchema.safeParse(formData.get("display_name"));
  if (!name.success) fail("invalid_name");
  const isChild = formData.get("is_child_profile") === "on";

  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId);
  if ((count ?? 0) >= MAX_PROFILES) fail("max_profiles");

  const { error } = await supabase.from("profiles").insert({
    user_id: session.userId,
    display_name: name.data,
    is_child_profile: isChild,
  });
  if (error) fail("create_failed");
  revalidatePath("/account/profiles");
}

export async function renameProfile(formData: FormData): Promise<void> {
  const session = await requireUser();
  const id = idSchema.safeParse(formData.get("profile_id"));
  const name = nameSchema.safeParse(formData.get("display_name"));
  if (!id.success || !name.success) fail("invalid_name");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.data })
    .eq("id", id.data)
    .eq("user_id", session.userId);
  if (error) fail("update_failed");
  revalidatePath("/account/profiles");
}

export async function toggleChildProfile(formData: FormData): Promise<void> {
  const session = await requireUser();
  const id = idSchema.safeParse(formData.get("profile_id"));
  if (!id.success) fail("invalid_profile");
  const next = formData.get("next_value") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_child_profile: next })
    .eq("id", id.data)
    .eq("user_id", session.userId);
  if (error) fail("update_failed");
  revalidatePath("/account/profiles");
}

export async function deleteProfile(formData: FormData): Promise<void> {
  const session = await requireUser();
  const id = idSchema.safeParse(formData.get("profile_id"));
  if (!id.success) fail("invalid_profile");

  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId);
  if ((count ?? 0) <= 1) fail("last_profile");

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id.data)
    .eq("user_id", session.userId);
  if (error) fail("delete_failed");
  revalidatePath("/account/profiles");
}
