"use client";

import { useActionState } from "react";
import { importMoviesCsv, type ImportReport } from "./actions";
import type { ActionResult } from "../../_lib/adminAction";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ActionResult<ImportReport> | null, FormData>(
    importMoviesCsv,
    null,
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-xl border border-ink-600 bg-ink-800 p-5">
        <div className="space-y-1.5">
          <label htmlFor="csv_text" className="block text-sm text-mist-300">
            CSV өгөгдөл (буулгаж тавих)
          </label>
          <textarea
            id="csv_text"
            name="csv_text"
            rows={10}
            placeholder={"title_mn,title_en,original_title,release_year,duration_minutes,age_rating,country_code,genres,description_mn,poster_url,backdrop_url\nХар салхи,Black Wind,,2024,112,PG-13,MN,drama|action,\"Тайлбар, таслалтай\",,"}
            className="w-full rounded-lg border border-ink-600 bg-ink-900 px-4 py-2.5 font-mono text-xs text-mist-100 placeholder:text-mist-600 focus:border-royal-500"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="csv_file" className="block text-sm text-mist-300">
            Эсвэл CSV файл сонгох (≤2MB)
          </label>
          <input
            id="csv_file"
            name="csv_file"
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-xs text-mist-400 file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-mist-200"
          />
        </div>
        <Button type="submit" loading={pending}>
          Импортлох
        </Button>
        <p className="text-xs text-mist-500">Бүх мөр “Ноорог” төлөвтэйгөөр орж ирнэ.</p>
      </form>

      {state && !state.ok ? (
        <div role="alert" className="rounded-lg border border-red-700/40 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {state.error}
        </div>
      ) : null}

      {state && state.ok ? (
        <section className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-medium text-white">Импортын үр дүн</h2>
            <Badge tone="success">Амжилттай: {state.data.succeeded}</Badge>
            <Badge tone={state.data.failed > 0 ? "danger" : "default"}>Алдаатай: {state.data.failed}</Badge>
          </div>
          <div className="overflow-x-auto rounded-lg border border-ink-700">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-ink-900 text-left text-xs uppercase tracking-wide text-mist-500">
                <tr>
                  <th className="px-3 py-2">Мөр</th>
                  <th className="px-3 py-2">Нэр</th>
                  <th className="px-3 py-2">Төлөв</th>
                  <th className="px-3 py-2">Алдаа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {state.data.rows.map((r) => (
                  <tr key={r.line}>
                    <td className="px-3 py-2 text-mist-400">{r.line}</td>
                    <td className="px-3 py-2 text-mist-100">{r.title}</td>
                    <td className="px-3 py-2">
                      {r.ok ? <Badge tone="success">Орсон</Badge> : <Badge tone="danger">Алдаа</Badge>}
                    </td>
                    <td className="px-3 py-2 text-xs text-red-300">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
