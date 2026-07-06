export interface MiniBarDatum {
  label: string;
  value: number;
}

/**
 * Dependency-free bar chart for small admin dashboards.
 * Bars are SVG (stretchable), labels/values are HTML so text never distorts.
 * Server-renderable.
 */
export function MiniBar({
  data,
  height = 120,
  formatValue = (n) => n.toLocaleString("en-US"),
}: {
  data: MiniBarDatum[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-mist-500">Өгөгдөл алга</p>;
  }
  const max = Math.max(...data.map((d) => d.value));
  const allZero = max <= 0;
  const dense = data.length > 12;
  const gapCls = dense ? "gap-px" : "gap-2";

  return (
    <div>
      <div
        className={`flex items-end ${gapCls} border-b border-ink-600/60`}
        style={{ height }}
      >
        {data.map((d, i) => {
          const pct = allZero ? 0 : Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0);
          return (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex h-full flex-1 items-end justify-center"
              title={`${d.label}: ${formatValue(d.value)}`}
            >
              <div
                className="w-full max-w-14 rounded-t bg-royal-500/80 transition group-hover:bg-royal-400"
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? 4 : 0 }}
              />
              {d.value > 0 ? (
                <span className="pointer-events-none absolute -top-1 hidden -translate-y-full rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-mist-100 group-hover:block">
                  {formatValue(d.value)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className={`mt-1.5 flex ${gapCls}`}>
        {data.map((d, i) => (
          <span
            key={`${d.label}-l-${i}`}
            className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-mist-500"
          >
            {d.label}
          </span>
        ))}
      </div>
      {allZero ? (
        <p className="mt-3 text-center text-sm text-mist-500">
          Одоогоор орлого бүртгэгдээгүй байна
        </p>
      ) : null}
    </div>
  );
}
