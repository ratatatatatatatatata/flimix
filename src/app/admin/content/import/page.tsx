import { requireRole } from "@/lib/auth";
import { ImportForm } from "./ImportForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const HEADERS = [
  ["title_mn", "Монгол нэр (заавал)"],
  ["title_en", "Англи нэр"],
  ["original_title", "Эх нэр"],
  ["release_year", "Гарсан он (жнь: 2024)"],
  ["duration_minutes", "Үргэлжлэх хугацаа минутаар"],
  ["age_rating", "G / PG / PG-13 / R / NC-17"],
  ["country_code", "Улсын ISO код (жнь: MN, US)"],
  ["genres", "Төрлийн slug-ууд | тэмдэгтээр тусгаарлана (drama|action)"],
  ["description_mn", "Монгол тайлбар"],
  ["poster_url", "Постерын URL"],
  ["backdrop_url", "Арын зургийн URL"],
] as const;

export default async function ImportPage() {
  await requireRole("content_manager");

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <Link href="/admin/content" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Контент руу буцах
      </Link>
      <h1 className="text-2xl font-semibold text-white">CSV бөөнөөр импортлох</h1>

      <section className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-3 text-lg font-medium text-white">Толгой мөрийн баганууд</h2>
        <p className="mb-3 text-sm text-mist-400">
          Эхний мөр нь доорх багануудыг яг энэ нэрээр агуулсан байх ёстой. Хашилттай (&quot;...&quot;)
          талбар, таслал болон мөр таслалт дэмжигдэнэ.
        </p>
        <div className="overflow-x-auto rounded-lg border border-ink-700">
          <table className="w-full min-w-[480px] text-sm">
            <tbody className="divide-y divide-ink-700">
              {HEADERS.map(([key, desc]) => (
                <tr key={key}>
                  <td className="px-3 py-2 font-mono text-xs text-royal-300">{key}</td>
                  <td className="px-3 py-2 text-mist-300">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ImportForm />
    </div>
  );
}
