import { Input } from "@/components/ui/Input";
import { AGE_RATING_LABELS } from "@/lib/i18n";
import type { Country, Genre, Series } from "@/types/db";

const AGE_RATINGS = ["G", "PG", "PG-13", "R", "NC-17"] as const;
const selectCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500";

/** Server-rendered shared fields for the series create/edit form. */
export function SeriesFields({
  series,
  genres,
  countries,
  selectedGenreIds,
}: {
  series: Series | null;
  genres: Genre[];
  countries: Country[];
  selectedGenreIds: string[];
}) {
  const publishedAtLocal = series?.published_at
    ? new Date(series.published_at).toISOString().slice(0, 16)
    : "";

  return (
    <div className="space-y-4">
      {series ? <input type="hidden" name="id" value={series.id} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Input label="Монгол нэр *" name="title_mn" defaultValue={series?.title_mn ?? ""} required />
        <Input label="Англи нэр" name="title_en" defaultValue={series?.title_en ?? ""} />
        <Input label="Эх нэр" name="original_title" defaultValue={series?.original_title ?? ""} />
      </div>
      <Input
        label="Slug (URL хаяг) *"
        name="slug"
        defaultValue={series?.slug ?? ""}
        pattern="[a-z0-9\-]+"
        title="Латин жижиг үсэг, тоо, зураас"
        required
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="s_description_mn" className="block text-sm text-mist-300">Монгол тайлбар</label>
          <textarea
            id="s_description_mn"
            name="description_mn"
            rows={4}
            defaultValue={series?.description_mn ?? ""}
            className="w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="s_description_en" className="block text-sm text-mist-300">Англи тайлбар</label>
          <textarea
            id="s_description_en"
            name="description_en"
            rows={4}
            defaultValue={series?.description_en ?? ""}
            className="w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input label="Гарсан он" name="release_year" type="number" min={1900} max={2100} defaultValue={series?.release_year ?? ""} />
        <div className="space-y-1.5">
          <label htmlFor="s_age_rating" className="block text-sm text-mist-300">Насны ангилал</label>
          <select id="s_age_rating" name="age_rating" defaultValue={series?.age_rating ?? ""} className={selectCls}>
            <option value="">— Сонгох —</option>
            {AGE_RATINGS.map((r) => (
              <option key={r} value={r}>{AGE_RATING_LABELS[r] ?? r}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="s_country_id" className="block text-sm text-mist-300">Улс</label>
          <select id="s_country_id" name="country_id" defaultValue={series?.country_id ?? ""} className={selectCls}>
            <option value="">— Сонгох —</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name_mn}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm text-mist-300">Төрөл (жанр)</p>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <label
              key={g.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs text-mist-300 has-[:checked]:border-royal-500/60 has-[:checked]:bg-royal-700/30 has-[:checked]:text-royal-300"
            >
              <input
                type="checkbox"
                name="genre_ids"
                value={g.id}
                defaultChecked={selectedGenreIds.includes(g.id)}
                className="sr-only"
              />
              {g.name_mn}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input label="Постер URL" name="poster_url" type="url" defaultValue={series?.poster_url ?? ""} />
        <Input label="Арын зураг URL" name="backdrop_url" type="url" defaultValue={series?.backdrop_url ?? ""} />
        <Input label="Трейлер URL" name="trailer_url" type="url" defaultValue={series?.trailer_url ?? ""} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="s_status" className="block text-sm text-mist-300">Төлөв</label>
          <select
            id="s_status"
            name="status"
            defaultValue={
              series && ["draft", "scheduled", "published"].includes(series.status) ? series.status : "draft"
            }
            className={selectCls}
          >
            <option value="draft">Ноорог</option>
            <option value="scheduled">Товлох</option>
            <option value="published">Нийтлэх</option>
          </select>
        </div>
        <Input label="Нийтлэгдэх огноо" name="published_at" type="datetime-local" defaultValue={publishedAtLocal} />
      </div>
      <p className="text-xs text-mist-500">
        Нийтлэхийн тулд цувралд баталгаажсан, хүчинтэй контентын эрх бүртгэгдсэн байх шаардлагатай.
      </p>
    </div>
  );
}
