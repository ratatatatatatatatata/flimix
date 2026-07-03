"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAdminAction, must, AdminActionError } from "../_lib/adminAction";

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

/* ------------------------------------------------------------------ */
/* Content rights CRUD                                                 */
/* ------------------------------------------------------------------ */

const rightSchema = z
  .object({
    id: z.string().uuid().optional(),
    content: z
      .string()
      .regex(/^(movie|series):[0-9a-f-]{36}$/i, "Контент сонгоно уу"),
    partner_id: z.string().uuid().nullable(),
    rights_owner: z.string().min(1, "Эрх эзэмшигчийг оруулна уу"),
    contract_number: z.string().nullable(),
    rights_start: z.string().min(1, "Эхлэх огноо шаардлагатай"),
    rights_end: z.string().min(1, "Дуусах огноо шаардлагатай"),
    allowed_countries: z.array(z.string().length(2)),
    allowed_platforms: z.array(z.enum(["web", "mobile", "tv"])).min(1, "Дор хаяж нэг платформ сонгоно уу"),
    is_exclusive: z.boolean(),
    revenue_share_percent: z.coerce.number().min(0).max(100).nullable(),
  })
  .refine((v) => new Date(v.rights_end) > new Date(v.rights_start), {
    message: "Дуусах огноо эхлэхээс хойш байх ёстой",
    path: ["rights_end"],
  });

export async function saveRight(formData: FormData): Promise<void> {
  const result = await runAdminAction<{ id: string }>(
    "admin",
    "content_right.save",
    "content_right",
    async ({ db }) => {
      const countriesRaw = String(formData.get("allowed_countries") ?? "");
      const input = rightSchema.parse({
        id: optional(formData.get("id")) ?? undefined,
        content: String(formData.get("content") ?? ""),
        partner_id: optional(formData.get("partner_id")),
        rights_owner: String(formData.get("rights_owner") ?? "").trim(),
        contract_number: optional(formData.get("contract_number")),
        rights_start: String(formData.get("rights_start") ?? ""),
        rights_end: String(formData.get("rights_end") ?? ""),
        allowed_countries: countriesRaw
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        allowed_platforms: formData.getAll("allowed_platforms").map(String),
        is_exclusive: formData.get("is_exclusive") === "on",
        revenue_share_percent: optional(formData.get("revenue_share_percent")),
      });

      const [contentType, contentId] = input.content.split(":") as ["movie" | "series", string];
      const row = {
        content_type: contentType,
        content_id: contentId,
        partner_id: input.partner_id,
        rights_owner: input.rights_owner,
        contract_number: input.contract_number,
        rights_start: new Date(input.rights_start).toISOString(),
        rights_end: new Date(input.rights_end).toISOString(),
        allowed_countries: input.allowed_countries,
        allowed_platforms: input.allowed_platforms,
        is_exclusive: input.is_exclusive,
        revenue_share_percent: input.revenue_share_percent,
        updated_at: new Date().toISOString(),
      };

      let rightId: string;
      if (input.id) {
        must(
          await db.from("content_rights").update(row).eq("id", input.id).select("id").single(),
          "Эрх шинэчлэхэд алдаа",
        );
        rightId = input.id;
      } else {
        const created = must(
          await db
            .from("content_rights")
            .insert({ ...row, approval_status: "pending" })
            .select("id")
            .single(),
          "Эрх бүртгэхэд алдаа",
        ) as { id: string };
        rightId = created.id;
      }
      return {
        data: { id: rightId },
        entityId: rightId,
        details: { content_type: contentType, content_id: contentId, created: !input.id },
      };
    },
  );

  revalidatePath("/admin/rights");
  if (result.ok) {
    redirect(withParam(`/admin/rights/${result.data.id}`, "message", "Эрх хадгалагдлаа."));
  }
  const id = optional(formData.get("id"));
  redirect(withParam(id ? `/admin/rights/${id}` : "/admin/rights/new", "error", result.error));
}

export async function setRightApproval(formData: FormData): Promise<void> {
  const id = z.string().uuid().parse(formData.get("id"));
  const result = await runAdminAction<null>(
    "admin",
    "content_right.set_approval",
    "content_right",
    async ({ db }) => {
      const decision = z.enum(["approved", "rejected"]).parse(formData.get("decision"));
      const notes = optional(formData.get("admin_notes"));
      if (decision === "rejected" && !notes) {
        throw new AdminActionError("Татгалзахдаа тайлбар (админ тэмдэглэл) бичнэ үү.");
      }
      must(
        await db
          .from("content_rights")
          .update({ approval_status: decision, admin_notes: notes, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .single(),
        "Төлөв өөрчлөхөд алдаа",
      );
      return { data: null, entityId: id, details: { decision, notes } };
    },
  );
  revalidatePath("/admin/rights");
  revalidatePath(`/admin/rights/${id}`);
  redirect(
    result.ok
      ? withParam(`/admin/rights/${id}`, "message", "Батлах төлөв шинэчлэгдлээ.")
      : withParam(`/admin/rights/${id}`, "error", result.error),
  );
}

/* ------------------------------------------------------------------ */
/* Contract documents (private "rights-docs" bucket)                   */
/* ------------------------------------------------------------------ */

const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_DOC_BYTES = 10 * 1024 * 1024;

export async function uploadRightDocument(formData: FormData): Promise<void> {
  const rightId = z.string().uuid().parse(formData.get("right_id"));
  const result = await runAdminAction<null>(
    "admin",
    "content_right_document.upload",
    "content_right_document",
    async ({ db, session }) => {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) throw new AdminActionError("Файл сонгоно уу.");
      if (!ALLOWED_DOC_TYPES.includes(file.type)) {
        throw new AdminActionError("Зөвхөн PDF, JPG, PNG файл зөвшөөрөгдөнө.");
      }
      if (file.size > MAX_DOC_BYTES) throw new AdminActionError("Файл 10MB-аас хэтэрч болохгүй.");

      const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
      const path = `${rightId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from("rights-docs").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new AdminActionError(`Байршуулахад алдаа: ${error.message}`);

      const created = must(
        await db
          .from("content_right_documents")
          .insert({
            right_id: rightId,
            file_name: file.name,
            file_path: path,
            mime_type: file.type,
            size_bytes: file.size,
            uploaded_by: session.userId,
          })
          .select("id")
          .single(),
        "Баримт бүртгэхэд алдаа",
      ) as { id: string };
      return { data: null, entityId: created.id, details: { right_id: rightId, file_name: file.name } };
    },
  );
  revalidatePath(`/admin/rights/${rightId}`);
  redirect(
    result.ok
      ? withParam(`/admin/rights/${rightId}`, "message", "Баримт байршуулагдлаа.")
      : withParam(`/admin/rights/${rightId}`, "error", result.error),
  );
}

export async function deleteRightDocument(formData: FormData): Promise<void> {
  const rightId = z.string().uuid().parse(formData.get("right_id"));
  const result = await runAdminAction<null>(
    "admin",
    "content_right_document.delete",
    "content_right_document",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      const doc = must(
        await db.from("content_right_documents").select("id,file_path").eq("id", id).single(),
        "Баримт олдсонгүй",
      ) as { id: string; file_path: string };
      await db.storage.from("rights-docs").remove([doc.file_path]);
      must(
        await db.from("content_right_documents").delete().eq("id", id).select("id").single(),
        "Баримт устгахад алдаа",
      );
      return { data: null, entityId: id, details: { right_id: rightId } };
    },
  );
  revalidatePath(`/admin/rights/${rightId}`);
  redirect(
    result.ok
      ? withParam(`/admin/rights/${rightId}`, "message", "Баримт устгагдлаа.")
      : withParam(`/admin/rights/${rightId}`, "error", result.error),
  );
}

/* ------------------------------------------------------------------ */
/* Partners CRUD                                                       */
/* ------------------------------------------------------------------ */

const partnerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Нэр шаардлагатай"),
  contact_email: z.string().email("Имэйл буруу").nullable(),
  contact_phone: z.string().nullable(),
});

export async function savePartner(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "admin",
    "content_partner.save",
    "content_partner",
    async ({ db }) => {
      const input = partnerSchema.parse({
        id: optional(formData.get("id")) ?? undefined,
        name: String(formData.get("name") ?? "").trim(),
        contact_email: optional(formData.get("contact_email")),
        contact_phone: optional(formData.get("contact_phone")),
      });
      const row = {
        name: input.name,
        contact_email: input.contact_email,
        contact_phone: input.contact_phone,
      };
      let entityId: string;
      if (input.id) {
        must(
          await db.from("content_partners").update(row).eq("id", input.id).select("id").single(),
          "Түнш шинэчлэхэд алдаа",
        );
        entityId = input.id;
      } else {
        const created = must(
          await db.from("content_partners").insert(row).select("id").single(),
          "Түнш нэмэхэд алдаа",
        ) as { id: string };
        entityId = created.id;
      }
      return { data: null, entityId, details: { name: input.name, created: !input.id } };
    },
  );
  revalidatePath("/admin/rights/partners");
  redirect(
    result.ok
      ? withParam("/admin/rights/partners", "message", "Түнш хадгалагдлаа.")
      : withParam("/admin/rights/partners", "error", result.error),
  );
}

export async function deletePartner(formData: FormData): Promise<void> {
  const result = await runAdminAction<null>(
    "admin",
    "content_partner.delete",
    "content_partner",
    async ({ db }) => {
      const id = z.string().uuid().parse(formData.get("id"));
      const { count } = await db
        .from("content_rights")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", id);
      if ((count ?? 0) > 0) {
        throw new AdminActionError("Энэ түнштэй холбоотой эрх бүртгэлтэй тул устгах боломжгүй.");
      }
      must(
        await db.from("content_partners").delete().eq("id", id).select("id").single(),
        "Түнш устгахад алдаа",
      );
      return { data: null, entityId: id };
    },
  );
  revalidatePath("/admin/rights/partners");
  redirect(
    result.ok
      ? withParam("/admin/rights/partners", "message", "Түнш устгагдлаа.")
      : withParam("/admin/rights/partners", "error", result.error),
  );
}
