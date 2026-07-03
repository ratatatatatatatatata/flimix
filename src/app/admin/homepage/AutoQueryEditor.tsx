"use client";

import { useState } from "react";

const PRESETS: { key: string; label: string; value: string }[] = [
  { key: "newest", label: "Шинээр нэмэгдсэн", value: '{"type":"newest","limit":12}' },
  { key: "popular", label: "Түгээмэл", value: '{"type":"popular","limit":12}' },
  { key: "genre", label: "Төрлөөр (slug солино)", value: '{"type":"genre","genre":"drama","limit":12}' },
  { key: "country", label: "Улсаар (код солино)", value: '{"type":"country","country":"MN","limit":12}' },
  { key: "series", label: "Цувралууд", value: '{"type":"series","limit":12}' },
];

/** JSON editor with presets for auto homepage sections. */
export function AutoQueryEditor({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="aq-preset" className="text-sm text-mist-300">
          Бэлэн загвар:
        </label>
        <select
          id="aq-preset"
          defaultValue=""
          onChange={(e) => {
            const preset = PRESETS.find((p) => p.key === e.target.value);
            if (preset) setValue(preset.value);
          }}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-mist-100 focus:border-royal-500"
        >
          <option value="">— Сонгох —</option>
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>
      <textarea
        name="auto_query"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="auto_query JSON"
        className="w-full rounded-lg border border-ink-600 bg-ink-900 px-4 py-2.5 font-mono text-xs text-mist-100 focus:border-royal-500"
        placeholder='{"type":"newest","limit":12}'
      />
      <p className="text-xs text-mist-500">
        Талбарууд: type (newest/popular/genre/country/series), genre (slug), country (ISO код), limit (1-40).
      </p>
    </div>
  );
}
