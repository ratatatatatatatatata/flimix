import Link from "next/link";

export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  params = {},
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  params?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const mk = (p: number) => {
    const sp = new URLSearchParams(params);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const btn =
    "rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-mist-300 hover:border-royal-500/60 hover:text-white transition";
  const disabled =
    "rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-mist-500 cursor-not-allowed";

  return (
    <nav className="flex items-center justify-between gap-3 pt-4" aria-label="Хуудаслалт">
      {page > 1 ? (
        <Link href={mk(page - 1)} className={btn}>
          ← Өмнөх
        </Link>
      ) : (
        <span className={disabled}>← Өмнөх</span>
      )}
      <span className="text-sm text-mist-400">
        {page} / {pages} хуудас · нийт {total.toLocaleString("en-US")}
      </span>
      {page < pages ? (
        <Link href={mk(page + 1)} className={btn}>
          Дараах →
        </Link>
      ) : (
        <span className={disabled}>Дараах →</span>
      )}
    </nav>
  );
}
