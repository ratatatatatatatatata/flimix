# 10 — Recommendations

Principle: **for a 300–2,000 title catalog, recommendation quality is a curation and
SQL problem, not a machine-learning problem.** MVP ships cheap, explainable queries;
the schema already captures everything a future personalization layer needs.

## 1. MVP strategy (cheap SQL, ships in Phase 1)

| Surface | Logic | Implementation |
|---|---|---|
| "Similar titles" (detail page) | Same genres, cast overlap, same country — scored | One query over `movie_genres`/`movie_cast` junctions (below) |
| "Popular" rows | `popularity` column, maintained by a nightly job from watch_sessions counts (decayed) | `order by popularity desc` on published content |
| "Trending this week" | Distinct viewers over trailing 7 days | Aggregate on `watch_sessions` (started_at > now()-7d), small enough to compute nightly into `popularity`-style column or matview |
| Editorial collections | Human taste — the strongest signal at this catalog size | `homepage_sections` manual + `auto_query` (docs/07 §6) |
| Continue watching | `watch_progress` where not completed, by `last_watched_at` | Per-profile row on landing |
| "New episodes for you" | Favorited series with recently published episodes | `favorites` × `episodes.published_at` |

### Similar-titles query (the workhorse)

```sql
select m.*,
       count(distinct mg2.genre_id) * 3          -- shared genres weigh most
     + count(distinct mc2.cast_member_id) * 2    -- shared cast
     + (m.country_id = $source_country_id)::int  -- same country (Mongolian titles cluster)
       as score
from movies m
join movie_genres mg2 on mg2.movie_id = m.id
 and mg2.genre_id in (select genre_id from movie_genres where movie_id = $source_id)
left join movie_cast mc2 on mc2.movie_id = m.id
 and mc2.cast_member_id in (select cast_member_id from movie_cast where movie_id = $source_id)
where m.id <> $source_id
  and m.status = 'published' and m.deleted_at is null
group by m.id
order by score desc, m.popularity desc
limit 12;
```

Milliseconds at 2,000 titles with the junction-table indexes. Series variant is
identical over `series_genres`/`series_cast`. Ties break on `popularity` so the list
never looks random. Results can be cached per title (`revalidate` ~1 h) since they
change slowly.

## 2. Data already captured for future personalization

No new instrumentation is needed later — Phase 1 writes all of this as a side effect
of normal product behavior:

| Signal | Source | Personalization use |
|---|---|---|
| What was watched, when, per profile | `watch_sessions` (append-only) | Co-occurrence, recency weighting |
| How much of it (completion rate) | `watch_progress.progress_seconds / duration_seconds`, `completed` | Strong implicit rating — a 97% completion beats any star |
| Explicit taste | `favorites` | Positive labels, cold-start seeds |
| Intent | search queries (logged server-side from `/api/search`) | Demand for missing catalog; query→watch conversion |
| Audience segment | `profiles.birth_date`, `is_child_profile` | Age-appropriate ranking, kids' rows |
| Context | `watch_sessions.device_id` → `device_type`, time-of-day | TV evening vs phone commute patterns |

Privacy note: all signals are first-party and profile-scoped; nothing leaves FLIMIX
infrastructure (data ownership, docs/08 §15).

## 3. Why no heavy AI for MVP

- Cold start: at launch there is no interaction history — editorial + genre logic *is*
  the optimal recommender on day one.
- At 300–2,000 items, matrix factorization/embeddings add ops cost and opacity for
  single-digit relevance gains over curated rows + the similarity query.
- The catalog is small enough that a human merchandiser (homepage sections) reliably
  beats a model — and speaks Mongolian.

## 4. Phase 3 sketch: item-item co-occurrence

When there are months of `watch_sessions`/`watch_progress` data, the pragmatic next
step is classic item-item collaborative filtering — still SQL, still no ML infra:

```sql
-- nightly batch → recommendation_pairs (content_a, content_b, strength)
with meaningful as (          -- watched ≥ 60% counts as a real signal
  select profile_id, content_type, content_id
  from watch_progress
  where duration_seconds > 0
    and progress_seconds >= duration_seconds * 0.6
)
select a.content_id as content_a, b.content_id as content_b,
       count(*)::float
         / sqrt(pa.viewers * pb.viewers)   -- cosine-style normalization
         as strength                        -- damps blockbuster dominance
from meaningful a
join meaningful b on a.profile_id = b.profile_id and a.content_id <> b.content_id
join (select content_id, count(distinct profile_id) viewers from meaningful group by 1) pa on pa.content_id = a.content_id
join (select content_id, count(distinct profile_id) viewers from meaningful group by 1) pb on pb.content_id = b.content_id
group by a.content_id, b.content_id, pa.viewers, pb.viewers
having count(*) >= 5                        -- minimum support
order by strength desc;
```

Design points:

- **Batch, not realtime.** Nightly cron (Supabase pg_cron or Vercel cron) into a
  `recommendation_pairs` table; serving is a keyed lookup — same cost profile as MVP.
- **Blend, don't replace:** `0.6 × co-occurrence + 0.4 × content-similarity` (the §1
  score) so new titles without viewing history still surface.
- Per-profile "because you watched X" rows come free: take the profile's recent
  completed titles, look up their top pairs, dedupe against already-watched.
- Guardrails: child profiles filter by age_rating *after* retrieval; published-only
  filter always applied at serve time (pairs may reference since-unpublished titles).
- Evaluate with holdout click/complete-through on the row before any further
  sophistication. Embeddings/LLM-based discovery remain "only if data says the simple
  thing plateaued".
