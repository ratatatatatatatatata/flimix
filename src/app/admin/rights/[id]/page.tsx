import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { RightFields, type ContentOption } from "../RightFields";
import { saveRight, setRightApproval, uploadRightDocument, deleteRightDocument } from "../actions";
import { MessageBanner } from "../../_components/MessageBanner";
import { rightsStatusLabel, rightsStatusTone, fmtDate, fmtDateTime, daysLeft } from "../../_lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import type { ContentPartner, ContentRight } from "@/types/db";
import type { ContentRightDocument } from "../../_lib/types";

export const dynamic = "force-dynamic";

export default async function RightDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const sp = await searchParams;
  const db = createAdminClient();

  const rightRes = await db.from("content_rights").select("*").eq("id", id).single();
  if (rightRes.error || !rightRes.data) notFound();
  const right = rightRes.data as ContentRight;

  const [movies, series, partners, docsRes] = await Promise.all([
    db.from("movies").select("id,title_mn").is("deleted_at", null).order("title_mn").limit(500),
    db.from("series").select("id,title_mn").is("deleted_at", null).order("title_mn").limit(500),
    db.from("content_partners").select("*").order("name"),
    db.from("content_right_documents").select("*").eq("right_id", id).order("created_at", { ascending: false }),
  ]);
  const docs = (docsRes.data ?? []) as ContentRightDocument[];

  // Signed URLs for the private bucket (1 hour).
  const signedByDoc = new Map<string, string>();
  if (docs.length) {
    const { data: signed } = await db.storage
      .from("rights-docs")
      .createSignedUrls(docs.map((d) => d.file_path), 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedByDoc.set(s.path, s.signedUrl);
    }
  }

  const contentOptions: ContentOption[] = [
    ...((movies.data ?? []) as { id: string; title_mn: string }[]).map((m) => ({
      value: `movie:${m.id}`,
      label: `Кино — ${m.title_mn}`,
    })),
    ...((series.data ?? []) as { id: string; title_mn: string }[]).map((s) => ({
      value: `series:${s.id}`,
      label: `Цуврал — ${s.title_mn}`,
    })),
  ];

  const left = daysLeft(right.rights_end);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Link href="/admin/rights" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Эрхийн жагсаалт руу буцах
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">Контентын эрх</h1>
        <Badge tone={rightsStatusTone[right.approval_status]}>{rightsStatusLabel[right.approval_status]}</Badge>
        {left >= 0 && left <= 30 ? <Badge tone={left <= 7 ? "danger" : "warning"}>{left} хоног үлдсэн</Badge> : null}
        {left < 0 ? <Badge tone="danger">Хугацаа дууссан</Badge> : null}
      </div>

      <MessageBanner message={sp.message} error={sp.error} />

      <form action={saveRight} className="space-y-6 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <RightFields right={right} partners={(partners.data ?? []) as ContentPartner[]} contentOptions={contentOptions} />
        <Button type="submit">Хадгалах</Button>
      </form>

      <section className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="text-lg font-medium text-white">Батлах шийдвэр</h2>
        <p className="text-sm text-mist-400">
          Одоогийн төлөв: {rightsStatusLabel[right.approval_status]}.
          {right.admin_notes ? ` Тэмдэглэл: ${right.admin_notes}` : ""}
        </p>
        <form action={setRightApproval} className="space-y-3">
          <input type="hidden" name="id" value={right.id} />
          <div className="space-y-1.5">
            <label htmlFor="admin_notes" className="block text-sm text-mist-300">Админ тэмдэглэл</label>
            <textarea
              id="admin_notes"
              name="admin_notes"
              rows={2}
              defaultValue={right.admin_notes ?? ""}
              className="w-full rounded-lg border border-ink-600 bg-ink-900 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" name="decision" value="approved" size="sm">
              Батлах
            </Button>
            <Button type="submit" name="decision" value="rejected" variant="danger" size="sm">
              Татгалзах
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="text-lg font-medium text-white">Гэрээний баримтууд</h2>
        <p className="text-xs text-mist-500">
          PDF, JPG, PNG (≤10MB). Файлууд хаалттай “rights-docs” bucket-д хадгалагдаж, түр хугацааны
          гарын үсэгтэй холбоосоор нээгдэнэ.
        </p>
        <form action={uploadRightDocument} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="right_id" value={right.id} />
          <input
            type="file"
            name="file"
            accept="application/pdf,image/jpeg,image/png"
            required
            aria-label="Гэрээний баримт сонгох"
            className="text-xs text-mist-400 file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-mist-200"
          />
          <Button type="submit" size="sm" variant="secondary">Байршуулах</Button>
        </form>
        {docs.length === 0 ? (
          <EmptyState title="Баримт алга" description="Гэрээний хуулбар, нэмэлт баримтуудыг энд байршуулна." />
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink-900/60 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-mist-100">
                  <FileText className="h-4 w-4 text-royal-300" aria-hidden />
                  {signedByDoc.has(d.file_path) ? (
                    <a
                      href={signedByDoc.get(d.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-royal-300"
                    >
                      {d.file_name}
                    </a>
                  ) : (
                    d.file_name
                  )}
                  <span className="text-xs text-mist-500">
                    {(d.size_bytes / 1024 / 1024).toFixed(1)}MB · {fmtDateTime(d.created_at)}
                  </span>
                </span>
                <form action={deleteRightDocument}>
                  <input type="hidden" name="right_id" value={right.id} />
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                    Устгах
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-mist-600">Бүртгэсэн: {fmtDate(right.created_at)} · Шинэчилсэн: {fmtDate(right.updated_at)}</p>
    </div>
  );
}
