import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  contentType: z.enum(["movie", "episode"]),
  contentId: z.string().uuid(),
  progressSeconds: z.number().min(0).finite(),
  durationSeconds: z.number().positive().finite(),
  sessionId: z.string().uuid().optional(),
});

/** Progress counts as completed once >= 95% has been watched. */
const COMPLETED_RATIO = 0.95;

/**
 * Lightweight in-memory rate limit: max 1 write per user per 5 seconds.
 * Per-instance only (fine for a single Next.js server; a shared store would be
 * needed for a multi-instance deployment).
 */
const RATE_LIMIT_MS = 5000;
const lastWriteAt = new Map<string, number>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const last = lastWriteAt.get(userId);
  if (last !== undefined && now - last < RATE_LIMIT_MS) return true;
  lastWriteAt.set(userId, now);
  // Opportunistic cleanup so the map cannot grow unbounded.
  if (lastWriteAt.size > 10_000) {
    for (const [key, ts] of lastWriteAt) {
      if (now - ts > RATE_LIMIT_MS) lastWriteAt.delete(key);
    }
  }
  return false;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const { contentType, contentId, progressSeconds, durationSeconds, sessionId } =
    parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json({ ok: true, throttled: true }, { status: 200 });
  }

  const completed = progressSeconds >= durationSeconds * COMPLETED_RATIO;
  const admin = createAdminClient();

  const { error } = await admin.from("watch_progress").upsert(
    {
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      progress_seconds: Math.floor(progressSeconds),
      duration_seconds: Math.floor(durationSeconds),
      completed,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,content_type,content_id" },
  );
  if (error) {
    return NextResponse.json({ error: "Хадгалж чадсангүй" }, { status: 500 });
  }

  // Keep-alive: an open session stays active (ended_at null) while the player
  // reports progress; stale sessions age out of the concurrency window.
  if (sessionId) {
    await admin
      .from("watch_sessions")
      .update({ ended_at: null, status: "active" })
      .eq("id", sessionId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true, completed });
}
