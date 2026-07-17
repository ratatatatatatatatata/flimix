import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Movie } from "@/types/db";
import { startRentCheckout } from "./actions";

export const metadata: Metadata = { title: "Кино түрээслэх — FLIMIX" };
export const dynamic = "force-dynamic";

const PROVIDERS: { id: string; label: string }[] = [
  { id: "qpay", label: "QPay" },
  { id: "socialpay", label: "SocialPay" },
  { id: "bank_transfer", label: "Банкны шилжүүлэг" },
];

export default async function RentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/rent/${id}`)}`);

  const db = await createClient();
  const { data } = await db
    .from("movies")
    .select("id, slug, title_mn, poster_url, rental_price_mnt, rental_hours")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  const movie = data as Pick<
    Movie,
    "id" | "slug" | "title_mn" | "poster_url" | "rental_price_mnt" | "rental_hours"
  > | null;
  if (!movie || !movie.rental_price_mnt) notFound();

  // Already rented and still active? Straight to the player.
  const { data: purchase } = await db
    .from("movie_purchases")
    .select("id")
    .eq("user_id", session.userId)
    .eq("movie_id", movie.id)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (purchase) redirect(`/watch/movie/${movie.id}`);

  const price = new Intl.NumberFormat("mn-MN").format(movie.rental_price_mnt);

  return (
    <div className="min-h-screen bg-ink-950">
      <div className="container-fx flex justify-center py-12 lg:py-16">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-ink-700 bg-ink-900/70 p-6">
          <div className="flex items-center gap-4">
            {movie.poster_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- small poster thumb
              <img
                src={movie.poster_url}
                alt={movie.title_mn}
                className="h-24 w-16 rounded-lg object-cover"
              />
            ) : null}
            <div>
              <h1 className="text-lg font-semibold text-white">{movie.title_mn}</h1>
              <p className="mt-1 text-sm text-mist-400">
                Түрээс: <span className="font-medium text-white">{price}₮</span> /{" "}
                {movie.rental_hours} цаг
              </p>
            </div>
          </div>

          {sp.error ? (
            <p role="alert" className="rounded-lg border border-red-700/40 bg-red-900/30 px-4 py-3 text-sm text-red-300">
              Нэхэмжлэх үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm text-mist-300">Төлбөрийн хэрэгсэл сонгоно уу:</p>
            {PROVIDERS.map((p) => (
              <form key={p.id} action={startRentCheckout}>
                <input type="hidden" name="movieId" value={movie.id} />
                <input type="hidden" name="provider" value={p.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-3 text-left text-sm font-medium text-mist-100 transition hover:border-royal-500/60 hover:bg-ink-700"
                >
                  {p.label}
                </button>
              </form>
            ))}
          </div>

          <Link
            href={`/movie/${movie.slug}`}
            className="block text-center text-sm text-mist-400 hover:text-white"
          >
            Буцах
          </Link>
        </div>
      </div>
    </div>
  );
}
