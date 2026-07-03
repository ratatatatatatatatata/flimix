export interface MiniBarDatum {
  label: string;
  value: number;
}

/**
 * Dependency-free inline SVG bar chart for small admin dashboards.
 * Server-renderable; values are shown via <title> tooltips.
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
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length;
  const chartH = height - 22;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      className="w-full"
      role="img"
      aria-label="Баганан диаграм"
      preserveAspectRatio="none"
      style={{ height }}
    >
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * (chartH - 6), d.value > 0 ? 2 : 0.5);
        const x = i * barW + barW * 0.15;
        const w = barW * 0.7;
        return (
          <g key={`${d.label}-${i}`}>
            <rect
              x={x}
              y={chartH - h}
              width={w}
              height={h}
              rx={1}
              className="fill-royal-500/80 hover:fill-royal-400"
            >
              <title>{`${d.label}: ${formatValue(d.value)}`}</title>
            </rect>
            <text
              x={i * barW + barW / 2}
              y={height - 8}
              textAnchor="middle"
              className="fill-mist-500"
              style={{ fontSize: 4.5 }}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
