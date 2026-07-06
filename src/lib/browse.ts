/**
 * Shared /browse filter model — pure, isomorphic helpers used by the server
 * page, the cached catalog queries and the client FilterBar. Keep this file
 * free of server- or client-only imports.
 */

export const PAGE_SIZE = 24;
export const DECADES = [2020, 2010, 2000, 1990, 1980] as const;

export type ContentTypeFilter = "all" | "movie" | "series";
export type SortKey = "newest" | "popular" | "rating" | "title";

export interface BrowseFilters {
  type: ContentTypeFilter;
  genre: string | null;
  country: string | null;
  decade: number | null;
  sub: string | null;
  sort: SortKey;
  page: number;
}

export type BrowseSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export function parseBrowseFilters(sp: BrowseSearchParams): BrowseFilters {
  const typeRaw = first(sp.type);
  const sortRaw = first(sp.sort);
  const decadeRaw = Number(first(sp.decade));
  const pageRaw = Number(first(sp.page));
  return {
    type: typeRaw === "movie" || typeRaw === "series" ? typeRaw : "all",
    genre: first(sp.genre),
    country: first(sp.country),
    decade: DECADES.includes(decadeRaw as (typeof DECADES)[number]) ? decadeRaw : null,
    sub: first(sp.sub),
    sort:
      sortRaw === "popular" || sortRaw === "rating" || sortRaw === "title"
        ? sortRaw
        : "newest",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

/** Build a /browse href from current filters + patch; resets page unless patched. */
export function buildBrowseHref(f: BrowseFilters, patch: Partial<BrowseFilters>): string {
  const next: BrowseFilters = { ...f, ...patch, page: patch.page ?? 1 };
  const params = new URLSearchParams();
  if (next.type !== "all") params.set("type", next.type);
  if (next.genre) params.set("genre", next.genre);
  if (next.country) params.set("country", next.country);
  if (next.decade) params.set("decade", String(next.decade));
  if (next.sub) params.set("sub", next.sub);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/browse?${qs}` : "/browse";
}
