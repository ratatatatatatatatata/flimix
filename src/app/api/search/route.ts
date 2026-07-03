import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Movie, Series } from "@/types/db";

const querySchema = z.object({
  q: z.string().min(1, "Хайлтын үг шаардлагатай").max(100, "Хайлтын үг хэт урт байна"),
});

interface SearchResult {
  id: string;
  slug: string;
  type: "movie" | "series";
  title: string;
  posterUrl: string | null;
  year: number | null;
}

const RESULT_LIMIT = 20;
const CACHE_HEADER = "public, s-maxage=30, stale-while-revalidate=60";

type MovieRow = Pick<
  Movie,
  "id" | "slug" | "title_mn" | "title_en" | "original_title" | "poster_url" | "release_year" | "popularity"
>;
type SeriesRow = Pick<
  Series,
  "id" | "slug" | "title_mn" | "title_en" | "original_title" | "poster_url" | "release_year" | "popularity"
>;

/** Row shape expected from an optional pg_trgm `search_catalog(q text)` RPC. */
interface RpcRow {
  id: string;
  slug: string;
  content_type: string;
  title_mn: string;
  poster_url: string | null;
  release_year: number | null;
  similarity?: number;
}

const SELECT_COLS =
  "id, slug, title_mn, title_en, original_title, poster_url, release_year, popularity";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const parsed = querySchema.safeParse({ q: req.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хайлт" },
      { status: 400 },
    );
  }

  // PostgREST `or=` syntax breaks on commas/parens — strip them, escape LIKE wildcards.
  const sanitized = parsed.data.q.trim().replace(/[,()]/g, " ").replace(/[%_]/g, "\\$&").trim();
  if (sanitized.length === 0) {
    return NextResponse.json(
      { results: [] as SearchResult[] },
      { headers: { "Cache-Control": CACHE_HEADER } },
    );
  }

  const db = await createClient();
  const pattern = `%${sanitized}%`;
  const orExpr = `title_mn.ilike.${pattern},title_en.ilike.${pattern},original_title.ilike.${pattern}`;

  const [moviesRes, seriesRes] = await Promise.all([
    db
      .from("movies")
      .select(SELECT_COLS)
      .eq("status", "published")
      .is("deleted_at", null)
      .or(orExpr)
      .order("popularity", { ascending: false })
      .limit(RESULT_LIMIT),
    db
      .from("series")
      .select(SELECT_COLS)
      .eq("status", "published")
      .is("deleted_at", null)
      .or(orExpr)
      .order("popularity", { ascending: false })
      .limit(RESULT_LIMIT),
  ]);

  const scored = new Map<string, { result: SearchResult; score: number }>();

  for (const m of (moviesRes.data ?? []) as unknown as MovieRow[]) {
    scored.set(`movie-${m.id}`, {
      score: m.popularity,
      result: {
        id: m.id,
        slug: m.slug,
        type: "movie",
        title: m.title_mn,
        posterUrl: m.poster_url,
        year: m.release_year,
      },
    });
  }
  for (const s of (seriesRes.data ?? []) as unknown as SeriesRow[]) {
    scored.set(`series-${s.id}`, {
      score: s.popularity,
      result: {
        id: s.id,
        slug: s.slug,
        type: "series",
        title: s.title_mn,
        posterUrl: s.poster_url,
        year: s.release_year,
      },
    });
  }

  // Typo-tolerant fallback: optional pg_trgm-backed `search_catalog` function.
  // If the function does not exist (or errors), silently keep the ilike results.
  try {
    const { data: rpcData, error: rpcError } = await db.rpc("search_catalog", {
      q: parsed.data.q.trim(),
    });
    if (!rpcError && Array.isArray(rpcData)) {
      for (const row of rpcData as unknown as RpcRow[]) {
        const type = row.content_type === "series" ? "series" : "movie";
        const key = `${type}-${row.id}`;
        if (!scored.has(key)) {
          scored.set(key, {
            score: (row.similarity ?? 0) * 10,
            result: {
              id: row.id,
              slug: row.slug,
              type,
              title: row.title_mn,
              posterUrl: row.poster_url,
              year: row.release_year,
            },
          });
        }
      }
    }
  } catch {
    // RPC unavailable — ilike results are the answer.
  }

  const results = [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_LIMIT)
    .map((entry) => entry.result);

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": CACHE_HEADER } },
  );
}
