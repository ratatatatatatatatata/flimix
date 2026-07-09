import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { t } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSignedPlaybackUrl, type SignedPlayback } from "@/lib/video";
import type {
  AudioTrack,
  Episode,
  Movie,
  Subscription,
  SubscriptionPlan,
  SubtitleTrack,
  VideoAsset,
} from "@/types/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  contentType: z.enum(["movie", "episode"]),
  contentId: z.string().uuid(),
});

/** Concurrent-stream window: sessions started within the last 6 hours count. */
const STREAM_WINDOW_MS = 6 * 60 * 60 * 1000;

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "";
  return createHash("sha256").update(ip + salt).digest("hex");
}

type SubscriptionWithPlan = Omit<Subscription, "plan"> & {
  plan: SubscriptionPlan | null;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }
  const { contentType, contentId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Load content + playback asset (admin client: asset paths are not public).
  let playbackAssetId: string | null = null;
  let isFree = false;
  if (contentType === "movie") {
    const { data } = await admin
      .from("movies")
      .select("*")
      .eq("id", contentId)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    const movie = data as Movie | null;
    if (!movie) {
      return NextResponse.json({ error: t.contentUnavailable }, { status: 404 });
    }
    playbackAssetId = movie.playback_asset_id;
    isFree = movie.is_free;
  } else {
    const { data } = await admin
      .from("episodes")
      .select("*")
      .eq("id", contentId)
      .eq("status", "published")
      .maybeSingle();
    const episode = data as Episode | null;
    if (!episode) {
      return NextResponse.json({ error: t.contentUnavailable }, { status: 404 });
    }
    playbackAssetId = episode.playback_asset_id;
  }

  if (!playbackAssetId) {
    return NextResponse.json({ error: t.contentUnavailable }, { status: 404 });
  }

  const { data: assetRow } = await admin
    .from("video_assets")
    .select("*")
    .eq("id", playbackAssetId)
    .maybeSingle();
  const asset = assetRow as VideoAsset | null;
  if (!asset || asset.status !== "ready") {
    return NextResponse.json({ error: t.contentUnavailable }, { status: 404 });
  }

  // Entitlement: free movies play for any signed-in user; everything else
  // needs an active or trial subscription.
  const { data: subRow } = await admin
    .from("subscriptions")
    .select("*, plan:subscription_plans(*)")
    .eq("user_id", user.id)
    .in("status", ["active", "trial"])
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscription = subRow as SubscriptionWithPlan | null;

  if (!isFree && !subscription) {
    return NextResponse.json({ error: t.subscriptionRequired }, { status: 403 });
  }

  // Concurrent stream limit per plan.
  if (subscription?.plan && subscription.plan.stream_limit > 0) {
    const windowStart = new Date(Date.now() - STREAM_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("watch_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("started_at", windowStart);
    if ((count ?? 0) >= subscription.plan.stream_limit) {
      return NextResponse.json(
        {
          error:
            "Нэгэн зэрэг үзэх урсгалын хязгаарт хүрсэн байна. Өөр төхөөрөмж дээрх тоглуулалтыг зогсоогоод дахин оролдоно уу.",
        },
        { status: 409 },
      );
    }
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0";

  const { data: sessionRow, error: sessionError } = await admin
    .from("watch_sessions")
    .insert({
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      ip_hash: hashIp(ip),
      status: "active",
    })
    .select("id")
    .single();
  if (sessionError) {
    return NextResponse.json({ error: t.errorGeneric }, { status: 500 });
  }
  const sessionId = (sessionRow as { id: string }).id;

  let signed: SignedPlayback;
  try {
    signed = await getSignedPlaybackUrl(asset);
  } catch (err) {
    console.error("playback: signing failed", err);
    return NextResponse.json({ error: t.errorGeneric }, { status: 500 });
  }

  const { data: subtitleRows } = await admin
    .from("subtitle_tracks")
    .select("*, language:languages(*)")
    .eq("content_type", contentType)
    .eq("content_id", contentId);
  const subtitles = (subtitleRows ?? []) as SubtitleTrack[];

  // Dub audio tracks: only rows that actually carry a playable URL. When at
  // least one exists the player replaces the video's original audio entirely.
  const { data: audioRows } = await admin
    .from("audio_tracks")
    .select("*, language:languages(*)")
    .eq("content_type", contentType)
    .eq("content_id", contentId);
  const audioTracks = ((audioRows ?? []) as AudioTrack[])
    .filter(
      (track): track is AudioTrack & { url: string } =>
        typeof track.url === "string" && track.url.length > 0,
    )
    .map((track) => ({
      id: track.id,
      label: track.label,
      url: track.url,
      isDefault: track.is_default,
      language: track.language?.code ?? null,
    }));

  const { data: progressRow } = await admin
    .from("watch_progress")
    .select("progress_seconds")
    .eq("user_id", user.id)
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .maybeSingle();
  const progressSeconds =
    (progressRow as { progress_seconds: number } | null)?.progress_seconds ?? 0;

  return NextResponse.json({
    hlsUrl: signed.hlsUrl,
    expiresAt: signed.expiresAt,
    subtitles,
    audioTracks,
    progressSeconds,
    sessionId,
  });
}
