import { requireRole } from "@/lib/auth";
import { SectionFields } from "../SectionFields";
import { saveSection } from "../actions";
import { MessageBanner } from "../../_components/MessageBanner";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewSectionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("content_manager");
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Link href="/admin/homepage" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Нүүр хуудас руу буцах
      </Link>
      <h1 className="text-2xl font-semibold text-white">Шинэ хэсэг</h1>
      <MessageBanner error={sp.error} />
      <form action={saveSection} className="space-y-6 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <SectionFields section={null} />
        <Button type="submit">Хэсэг үүсгэх</Button>
      </form>
    </div>
  );
}
