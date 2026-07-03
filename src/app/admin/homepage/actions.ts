"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAdminAction, must, AdminActionError } from "../_lib/adminAction";
import type { HomepageSection } from "@/types/db";

const optional = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

function withParam(path: string, key: "message" | "error", value: string): string {
  const [base, qs] = path.split("?");
  const sp = new URLSearchParams(qs ?? "");
  sp.delete("message");
  sp.delete("error");
  sp.set(key, value);
  return `${base}?${sp.toString()}`;
}

const autoQuerySchema = z
  .object({
    type: z.enum(["newest", "popular", "genre", "country", "series"]),
    genre: z.string().optional(),
    country: z.string().optional(),
    limit: z.number().int().min(1).max(40).optional(),
  })
  .strict();

const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1, "Slug шаардлагатай")
    .regex(/^[a-z0-9-]+$/, "Slug зөвхөн латин жижиг үсэг, тоо, зураас"),
  title_mn: z.string().min(1, "Гарчиг шаардлагатай"),
  layout: z.enum(["hero", "row", "grid", "banner"]),
  query_type: z.enum(["manual", "auto"]),
  auto_query_raw: z.string().nullable(),
  visible_from: z.string().nullable(),
  visible_until: z.string().nullable(),
  device_visibility: z.array(z.enum(["web", "mobile", "tv"])).min(1, "Дор хаяж нэг төхөөрөмж сонгоно уу"),
  status: z.enum(["draft", "published"]),
});

export async function saveSection(formData: FormData): Promise<void> {
  const result = await runAdminAction<{ id: string }>(
    "content_manager",
    "homepage_section.save",
    "homepage_section",
    async ({ db }) => {
      const input = sectionSchema.parse({
        id: optional(formData.get("id")) ?? undefined,
        slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
        title_mn: String(formData.get("title_mn") ?? "").trim(),
        layout: String(formData.get("layout") ?? "row"),
        query_type: String(formData.get("query_type") ?? "manual"),
        auto_query_raw: optional(formData.get("auto_query")),
        visible_from: optional(formData.get("visible_from")),
        visible_until: optional(formData.get("visible_until")),
        device_visibility: formData.getAll("device_visibility").map(String),
        status: String(formData.get("status") ?? "draft"),
      });

      let autoQuery: Record<string, unknown> | null = null;
      if (input.query_type === "auto") {
        if (!input.auto_query_raw) throw new AdminActionError("Автомат хэсэгт auto_query JSON шаардлагатай.");
        let parsed: unknown;
        try {
          parsed = JSON.parse(input.auto_query_raw);
        } catch {
          throw new AdminActionError("auto_query нь хүчинтэй JSON биш байна.");
        }
        autoQuery = autoQuerySchema.parse(parsed);
      }

      const row = {
        slug: input.slug,
        title_mn: input.title_mn,
        layout: input.layout,
        query_type: input.query_type,
        auto_query: autoQuery,
        visible_from: input.visible_from ? new Date(input.visible_from).toISOString() : null,
        visible_until: input.visible_until ? new Date(input.visible_until).toISOString() : null,
        device_visibility: input.device_visibility,
        status: input.status,
      };

      let sectionId: string;
      if (input.id) {
        must(
          await db.from("homepage_sections").update(row).eq("id", input.id).select("id").single(),
          "Хэсэг шинэчлэхэд алдаа",
        );
        sectionId = input.id;
      } else {
        const { data: maxRow } = await db
          .from("homepage_sections")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1);
        const nextOrder = (((maxRow ?? []) as { sort_order: number }[])[0]?.sort_order ?? 0) + 1;
        const created = must(
          await db
            .from("homepage_sections")
            .insert({ ...row, sort_order: nextOrder })
            .select("id")
            .single(),
          "Хэсэг үүсгэхэд алдаа",
        ) as { id: string };
        sectionId = created.id;
      }
      return { data: { id: sectionId }, entityId: sectionId, details: { slug: input.slug, created: !input.id } };
    },
  );
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  if (result.ok) {
    redirect(withParam(`/admin/homepage/${result.data.id}`, "message", "Хэсэг хадгалагдлаа."));
  }
  const id = optional(formData.get("id"));
  redirect(withParam(id ? `/admin/homepage/${id}` : "/admin/homepage/new", "error", result.error));
}

export async function deleteSection(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "content_manager",
    "homepage_section.delete",
    "homepage_section",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      await db.from("homepage_section_items").delete().eq("section_id", id);
      must(await db.from("homepage_sections").delete().eq("id", id).select("id").single(), "Устгахад алдаа");
      return { data: null, entityId: id };
    },
  );
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  redirect(
    result.ok
      ? withParam("/admin/homepage", "message", "Хэсэг устгагдлаа.")
      : withParam("/admin/homepage", "error", result.error),
  );
}

export async function moveSection(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "content_manager",
    "homepage_section.reorder",
    "homepage_section",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      const dir = z.enum(["up", "down"]).parse(formData.get("dir"));
      const sections = must(
        await db.from("homepage_sections").select("id,sort_order").order("sort_order"),
        "Хэсгүүд уншихад алдаа",
      ) as Pick<HomepageSection, "id" | "sort_order">[];
      const idx = sections.findIndex((s) => s.id === id);
      if (idx === -1) throw new AdminActionError("Хэсэг олдсонгүй.");
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sections.length) {
        return { data: null, entityId: id, details: { dir, noop: true } };
      }
      const a = sections[idx];
      const b = sections[swapIdx];
      if (!a || !b) {
        return { data: null, entityId: id, details: { dir } };
      }
      must(
        await db.from("homepage_sections").update({ sort_order: b.sort_order }).eq("id", a.id).select("id").single(),
        "Эрэмбэ солиход алдаа",
      );
      must(
        await db.from("homepage_sections").update({ sort_order: a.sort_order }).eq("id", b.id).select("id").single(),
        "Эрэмбэ солиход алдаа",
      );
      return { data: null, entityId: id, details: { dir } };
    },
  );
  revalidatePath("/admin/homepage");
  revalidatePath("/");
  if (!result.ok) redirect(withParam("/admin/homepage", "error", result.error));
  redirect("/admin/homepage");
}

/* ------------------------------------------------------------------ */
/* Manual section items                                                 */
/* ------------------------------------------------------------------ */

export async function addSectionItem(formData: FormData): Promise<void> {
  const sectionId = z.string().uuid().parse(formData.get("section_id"));
  const back = `/admin/homepage/${sectionId}`;
  const result = await runAdminAction<null>(
    "content_manager",
    "homepage_section_item.add",
    "homepage_section_item",
    async ({ db }) => {
      const content = z
        .string()
        .regex(/^(movie|series):[0-9a-f-]{36}$/i, "Контент сонгоно уу")
        .parse(formData.get("content"));
      const [contentType, contentId] = content.split(":") as ["movie" | "series", string];

      const { data: dup } = await db
        .from("homepage_section_items")
        .select("id")
        .eq("section_id", sectionId)
        .eq("content_type", contentType)
        .eq("content_id", contentId)
        .limit(1);
      if ((dup ?? []).length > 0) throw new AdminActionError("Энэ контент аль хэдийн нэмэгдсэн байна.");

      const { data: maxRow } = await db
        .from("homepage_section_items")
        .select("sort_order")
        .eq("section_id", sectionId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (((maxRow ?? []) as { sort_order: number }[])[0]?.sort_order ?? 0) + 1;
      must(
        await db
          .from("homepage_section_items")
          .insert({ section_id: sectionId, content_type: contentType, content_id: contentId, sort_order: nextOrder })
          .select("id")
          .single(),
        "Нэмэхэд алдаа",
      );
      return { data: null, entityId: sectionId, details: { content_type: contentType, content_id: contentId } };
    },
  );
  revalidatePath(back);
  revalidatePath("/");
  redirect(
    result.ok ? withParam(back, "message", "Контент нэмэгдлээ.") : withParam(back, "error", result.error),
  );
}

export async function removeSectionItem(formData: FormData): Promise<void> {
  const sectionId = z.string().uuid().parse(formData.get("section_id"));
  const back = `/admin/homepage/${sectionId}`;
  const result = await runAdminAction<null>(
    "content_manager",
    "homepage_section_item.remove",
    "homepage_section_item",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      must(
        await db.from("homepage_section_items").delete().eq("id", id).select("id").single(),
        "Хасахад алдаа",
      );
      return { data: null, entityId: id, details: { section_id: sectionId } };
    },
  );
  revalidatePath(back);
  revalidatePath("/");
  redirect(
    result.ok ? withParam(back, "message", "Контент хасагдлаа.") : withParam(back, "error", result.error),
  );
}

export async function moveSectionItem(formData: FormData): Promise<void> {
  const sectionId = z.string().uuid().parse(formData.get("section_id"));
  const back = `/admin/homepage/${sectionId}`;
  const result = await runAdminAction<null>(
    "content_manager",
    "homepage_section_item.reorder",
    "homepage_section_item",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      const dir = z.enum(["up", "down"]).parse(formData.get("dir"));
      const items = must(
        await db
          .from("homepage_section_items")
          .select("id,sort_order")
          .eq("section_id", sectionId)
          .order("sort_order"),
        "Жагсаалт уншихад алдаа",
      ) as { id: string; sort_order: number }[];
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new AdminActionError("Мөр олдсонгүй.");
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= items.length) {
        return { data: null, entityId: id, details: { dir, noop: true } };
      }
      const a = items[idx];
      const b = items[swapIdx];
      if (!a || !b) {
        return { data: null, entityId: id, details: { dir } };
      }
      must(
        await db.from("homepage_section_items").update({ sort_order: b.sort_order }).eq("id", a.id).select("id").single(),
        "Эрэмбэ солиход алдаа",
      );
      must(
        await db.from("homepage_section_items").update({ sort_order: a.sort_order }).eq("id", b.id).select("id").single(),
        "Эрэмбэ солиход алдаа",
      );
      return { data: null, entityId: id, details: { dir } };
    },
  );
  revalidatePath(back);
  revalidatePath("/");
  if (!result.ok) redirect(withParam(back, "error", result.error));
  redirect(back);
}
