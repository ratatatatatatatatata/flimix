"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const toggleSchema = z.object({
  contentType: z.enum(["movie", "series"]),
  contentId: z.string().uuid(),
  /** Detail-page path to revalidate after toggling (e.g. /movie/slug). */
  path: z.string().startsWith("/").max(200).optional(),
});

export type ToggleFavoriteInput = z.infer<typeof toggleSchema>;

/**
 * Toggle a movie/series in the user's favorites.
 * Guests are redirected to /login. Shared by movie AND series detail pages.
 */
export async function toggleFavorite(
  input: ToggleFavoriteInput,
): Promise<{ favorited: boolean }> {
  const { contentType, contentId, path } = toggleSchema.parse(input);

  const session = await getSession();
  if (!session) redirect("/login");

  const db = await createClient();
  const column = contentType === "movie" ? "movie_id" : "series_id";

  const { data: existing } = await db
    .from("favorites")
    .select("id")
    .eq("user_id", session.userId)
    .eq(column, contentId)
    .maybeSingle();

  if (existing) {
    await db
      .from("favorites")
      .delete()
      .eq("id", (existing as { id: string }).id)
      .eq("user_id", session.userId);
    if (path) revalidatePath(path);
    return { favorited: false };
  }

  await db.from("favorites").insert({
    user_id: session.userId,
    movie_id: contentType === "movie" ? contentId : null,
    series_id: contentType === "series" ? contentId : null,
  });
  if (path) revalidatePath(path);
  return { favorited: true };
}
