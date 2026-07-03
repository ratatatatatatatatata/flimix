import { Input } from "@/components/ui/Input";
import type { ContentPartner, ContentRight } from "@/types/db";

const selectCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500";

export interface ContentOption {
  value: string; // "movie:<id>" | "series:<id>"
  label: string;
}

/** Server-rendered shared fields for the content-right create/edit form. */
export function RightFields({
  right,
  partners,
  contentOptions,
}: {
  right: ContentRight | null;
  partners: ContentPartner[];
  contentOptions: ContentOption[];
}) {
  return (
    <div className="space-y-4">
      {right ? <input type="hidden" name="id" value={right.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="r_content" className="block text-sm text-mist-300">Контент *</label>
          <select
            id="r_content"
            name="content"
            defaultValue={right ? `${right.content_type}:${right.content_id}` : ""}
            className={selectCls}
            required
          >
            <option value="">— Кино эсвэл цуврал сонгох —</option>
            {contentOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="r_partner" className="block text-sm text-mist-300">Түнш байгууллага</label>
          <select id="r_partner" name="partner_id" defaultValue={right?.partner_id ?? ""} className={selectCls}>
            <option value="">— Байхгүй —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Эрх эзэмшигч *" name="rights_owner" defaultValue={right?.rights_owner ?? ""} required />
        <Input label="Гэрээний дугаар" name="contract_number" defaultValue={right?.contract_number ?? ""} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Эрх эхлэх огноо *"
          name="rights_start"
          type="date"
          defaultValue={right ? right.rights_start.slice(0, 10) : ""}
          required
        />
        <Input
          label="Эрх дуусах огноо *"
          name="rights_end"
          type="date"
          defaultValue={right ? right.rights_end.slice(0, 10) : ""}
          required
        />
      </div>
      <Input
        label="Зөвшөөрөгдсөн улсууд (ISO кодуудыг таслалаар: MN,US,KR — хоосон бол бүх улс)"
        name="allowed_countries"
        defaultValue={right?.allowed_countries.join(",") ?? ""}
        placeholder="MN,US"
      />
      <div>
        <p className="mb-2 text-sm text-mist-300">Зөвшөөрөгдсөн платформууд *</p>
        <div className="flex flex-wrap gap-2">
          {(["web", "mobile", "tv"] as const).map((p) => (
            <label
              key={p}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs text-mist-300 has-[:checked]:border-royal-500/60 has-[:checked]:bg-royal-700/30 has-[:checked]:text-royal-300"
            >
              <input
                type="checkbox"
                name="allowed_platforms"
                value={p}
                defaultChecked={right ? right.allowed_platforms.includes(p) : true}
                className="sr-only"
              />
              {p === "web" ? "Веб" : p === "mobile" ? "Мобайл" : "ТВ"}
            </label>
          ))}
        </div>
      </div>
      <div className="grid items-end gap-4 md:grid-cols-2">
        <Input
          label="Орлого хуваах хувь (%)"
          name="revenue_share_percent"
          type="number"
          min={0}
          max={100}
          step="0.1"
          defaultValue={right?.revenue_share_percent ?? ""}
        />
        <label className="flex items-center gap-2 pb-2.5 text-sm text-mist-300">
          <input
            type="checkbox"
            name="is_exclusive"
            defaultChecked={right?.is_exclusive ?? false}
            className="h-4 w-4 accent-royal-500"
          />
          Онцгой (exclusive) эрх
        </label>
      </div>
    </div>
  );
}
