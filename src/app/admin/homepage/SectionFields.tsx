import { Input } from "@/components/ui/Input";
import { AutoQueryEditor } from "./AutoQueryEditor";
import type { HomepageSection } from "@/types/db";

const selectCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500";

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

export function SectionFields({ section }: { section: HomepageSection | null }) {
  return (
    <div className="space-y-4">
      {section ? <input type="hidden" name="id" value={section.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Гарчиг (MN) *" name="title_mn" defaultValue={section?.title_mn ?? ""} required />
        <Input label="Slug *" name="slug" defaultValue={section?.slug ?? ""} pattern="[a-z0-9\-]+" required />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="hs_layout" className="block text-sm text-mist-300">Байрлалын загвар</label>
          <select id="hs_layout" name="layout" defaultValue={section?.layout ?? "row"} className={selectCls}>
            <option value="hero">Hero (том танилцуулга)</option>
            <option value="row">Мөр (гүйдэг жагсаалт)</option>
            <option value="grid">Тор (grid)</option>
            <option value="banner">Баннер</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="hs_query_type" className="block text-sm text-mist-300">Контентын эх үүсвэр</label>
          <select id="hs_query_type" name="query_type" defaultValue={section?.query_type ?? "manual"} className={selectCls}>
            <option value="manual">Гараар сонгосон</option>
            <option value="auto">Автомат (query)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="hs_status" className="block text-sm text-mist-300">Төлөв</label>
          <select id="hs_status" name="status" defaultValue={section?.status ?? "draft"} className={selectCls}>
            <option value="draft">Ноорог</option>
            <option value="published">Нийтлэгдсэн</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-3">
        <p className="mb-2 text-sm text-mist-300">Автомат query (query_type = auto үед)</p>
        <AutoQueryEditor initialValue={section?.auto_query ? JSON.stringify(section.auto_query) : ""} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Харагдаж эхлэх" name="visible_from" type="datetime-local" defaultValue={toLocal(section?.visible_from ?? null)} />
        <Input label="Харагдахаа болих" name="visible_until" type="datetime-local" defaultValue={toLocal(section?.visible_until ?? null)} />
      </div>

      <div>
        <p className="mb-2 text-sm text-mist-300">Төхөөрөмж дээр харагдах</p>
        <div className="flex flex-wrap gap-2">
          {(["web", "mobile", "tv"] as const).map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs text-mist-300 has-[:checked]:border-royal-500/60 has-[:checked]:bg-royal-700/30 has-[:checked]:text-royal-300"
            >
              <input
                type="checkbox"
                name="device_visibility"
                value={d}
                defaultChecked={section ? section.device_visibility.includes(d) : true}
                className="sr-only"
              />
              {d === "web" ? "Веб" : d === "mobile" ? "Мобайл" : "ТВ"}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
