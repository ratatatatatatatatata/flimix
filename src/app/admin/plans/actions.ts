"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAdminAction, must, AdminActionError } from "../_lib/adminAction";

const optional = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

function back(tab: "plans" | "promo", key: "message" | "error", value: string): string {
  const sp = new URLSearchParams({ tab });
  sp.set(key, value);
  return `/admin/plans?${sp.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Subscription plans                                                   */
/* ------------------------------------------------------------------ */

const planSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1, "Slug шаардлагатай")
    .regex(/^[a-z0-9-]+$/, "Slug зөвхөн латин жижиг үсэг, тоо, зураас"),
  name_mn: z.string().min(1, "Монгол нэр шаардлагатай"),
  name_en: z.string().min(1, "Англи нэр шаардлагатай"),
  price_mnt: z.coerce.number().int().min(0, "Үнэ 0-ээс багагүй"),
  duration_days: z.coerce.number().int().min(1, "Хугацаа 1 хоногоос багагүй"),
  device_limit: z.coerce.number().int().min(1).max(20),
  stream_limit: z.coerce.number().int().min(1).max(10),
  trial_days: z.coerce.number().int().min(0).max(90),
  features_mn: z.array(z.string().min(1)),
  is_active: z.boolean(),
});

export async function savePlan(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "admin",
    "subscription_plan.save",
    "subscription_plan",
    async ({ db }) => {
      const input = planSchema.parse({
        id: optional(formData.get("id")) ?? undefined,
        slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
        name_mn: String(formData.get("name_mn") ?? "").trim(),
        name_en: String(formData.get("name_en") ?? "").trim(),
        price_mnt: formData.get("price_mnt"),
        duration_days: formData.get("duration_days"),
        device_limit: formData.get("device_limit"),
        stream_limit: formData.get("stream_limit"),
        trial_days: formData.get("trial_days"),
        features_mn: String(formData.get("features_mn") ?? "")
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
        is_active: formData.get("is_active") === "on",
      });
      const row = {
        slug: input.slug,
        name_mn: input.name_mn,
        name_en: input.name_en,
        price_mnt: input.price_mnt,
        duration_days: input.duration_days,
        device_limit: input.device_limit,
        stream_limit: input.stream_limit,
        trial_days: input.trial_days,
        features_mn: input.features_mn,
        is_active: input.is_active,
      };
      let entityId: string;
      if (input.id) {
        must(
          await db.from("subscription_plans").update(row).eq("id", input.id).select("id").single(),
          "Багц шинэчлэхэд алдаа",
        );
        entityId = input.id;
      } else {
        const created = must(
          await db.from("subscription_plans").insert(row).select("id").single(),
          "Багц үүсгэхэд алдаа",
        ) as { id: string };
        entityId = created.id;
      }

      // Sync the movies included in this plan (empty = plan covers everything).
      const movieIds = z
        .array(z.string().uuid())
        .parse(formData.getAll("movie_ids").map(String));
      await db.from("plan_movies").delete().eq("plan_id", entityId);
      if (movieIds.length > 0) {
        must(
          await db
            .from("plan_movies")
            .insert(movieIds.map((movieId) => ({ plan_id: entityId, movie_id: movieId })))
            .select("plan_id"),
          "Багцын кино хадгалахад алдаа",
        );
      }

      return { data: null, entityId, details: { slug: input.slug, created: !input.id, movies: movieIds.length } };
    },
  );
  revalidatePath("/admin/plans");
  revalidatePath("/subscribe");
  redirect(result.ok ? back("plans", "message", "Багц хадгалагдлаа.") : back("plans", "error", result.error));
}

export async function togglePlanActive(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "admin",
    "subscription_plan.toggle_active",
    "subscription_plan",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      const plan = must(
        await db.from("subscription_plans").select("is_active").eq("id", id).single(),
        "Багц олдсонгүй",
      ) as { is_active: boolean };
      must(
        await db
          .from("subscription_plans")
          .update({ is_active: !plan.is_active })
          .eq("id", id)
          .select("id")
          .single(),
        "Төлөв өөрчлөхөд алдаа",
      );
      return { data: null, entityId: id, details: { is_active: !plan.is_active } };
    },
  );
  revalidatePath("/admin/plans");
  revalidatePath("/subscribe");
  redirect(result.ok ? back("plans", "message", "Багцын төлөв өөрчлөгдлөө.") : back("plans", "error", result.error));
}

/* ------------------------------------------------------------------ */
/* Promo codes                                                          */
/* ------------------------------------------------------------------ */

const promoSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .min(3, "Код 3-аас дээш тэмдэгт")
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Код зөвхөн латин том үсэг, тоо, зураас"),
    discount_percent: z.coerce.number().int().min(1).max(100).nullable(),
    bonus_days: z.coerce.number().int().min(1).max(365).nullable(),
    max_uses: z.coerce.number().int().min(1).nullable(),
    valid_from: z.string().min(1, "Эхлэх огноо шаардлагатай"),
    valid_until: z.string().nullable(),
    is_active: z.boolean(),
  })
  .refine((v) => (v.discount_percent === null) !== (v.bonus_days === null), {
    message: "Хөнгөлөлтийн хувь ЭСВЭЛ урамшууллын хоногийн аль нэгийг л оруулна",
    path: ["discount_percent"],
  });

export async function savePromo(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "admin",
    "promo_code.save",
    "promo_code",
    async ({ db }) => {
      const input = promoSchema.parse({
        id: optional(formData.get("id")) ?? undefined,
        code: String(formData.get("code") ?? "").trim().toUpperCase(),
        discount_percent: optional(formData.get("discount_percent")),
        bonus_days: optional(formData.get("bonus_days")),
        max_uses: optional(formData.get("max_uses")),
        valid_from: String(formData.get("valid_from") ?? ""),
        valid_until: optional(formData.get("valid_until")),
        is_active: formData.get("is_active") === "on",
      });
      const row = {
        code: input.code,
        discount_percent: input.discount_percent,
        bonus_days: input.bonus_days,
        max_uses: input.max_uses,
        valid_from: new Date(input.valid_from).toISOString(),
        valid_until: input.valid_until ? new Date(input.valid_until).toISOString() : null,
        is_active: input.is_active,
      };
      let entityId: string;
      if (input.id) {
        must(
          await db.from("promo_codes").update(row).eq("id", input.id).select("id").single(),
          "Промо код шинэчлэхэд алдаа",
        );
        entityId = input.id;
      } else {
        const created = must(
          await db.from("promo_codes").insert(row).select("id").single(),
          "Промо код үүсгэхэд алдаа",
        ) as { id: string };
        entityId = created.id;
      }
      return { data: null, entityId, details: { code: input.code, created: !input.id } };
    },
  );
  revalidatePath("/admin/plans");
  redirect(result.ok ? back("promo", "message", "Промо код хадгалагдлаа.") : back("promo", "error", result.error));
}

export async function deletePromo(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "admin",
    "promo_code.delete",
    "promo_code",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      const promo = must(
        await db.from("promo_codes").select("used_count").eq("id", id).single(),
        "Промо код олдсонгүй",
      ) as { used_count: number };
      if (promo.used_count > 0) {
        throw new AdminActionError("Ашиглагдсан промо кодыг устгах боломжгүй. Идэвхгүй болгоно уу.");
      }
      must(await db.from("promo_codes").delete().eq("id", id).select("id").single(), "Устгахад алдаа");
      return { data: null, entityId: id };
    },
  );
  revalidatePath("/admin/plans");
  redirect(result.ok ? back("promo", "message", "Промо код устгагдлаа.") : back("promo", "error", result.error));
}
