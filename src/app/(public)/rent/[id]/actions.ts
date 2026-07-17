"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createRentalInvoice } from "@/lib/payments";

const schema = z.object({
  movieId: z.string().uuid(),
  provider: z.enum(["qpay", "socialpay", "bank_transfer"]),
});

/**
 * Starts a movie rental checkout. Mirrors subscribe/startCheckout: creates a
 * pending payment with movie metadata and redirects to the shared pay screen
 * (which polls verifyAndApplyPayment — the rental is granted there).
 */
export async function startRentCheckout(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    movieId: formData.get("movieId"),
    provider: formData.get("provider"),
  });
  if (!parsed.success) redirect("/");

  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/rent/${parsed.data.movieId}`)}`);
  }

  let invoice;
  try {
    invoice = await createRentalInvoice({
      userId: session.userId,
      movieId: parsed.data.movieId,
      provider: parsed.data.provider,
    });
  } catch {
    redirect(`/rent/${parsed.data.movieId}?error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    `flimix_inv_${invoice.paymentId}`,
    JSON.stringify({
      checkoutUrl: invoice.checkoutUrl ?? null,
      qrText: invoice.qrText ?? null,
      deeplinks: invoice.deeplinks ?? [],
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/subscribe",
      maxAge: 60 * 30,
    },
  );

  redirect(`/subscribe/pay/${invoice.paymentId}`);
}
