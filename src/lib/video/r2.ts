import "server-only";
import { createHmac } from "node:crypto";
import type { VideoAsset } from "@/types/db";
import type { SignedPlayback, VideoProvider } from "./types";

const DEFAULT_TTL_SECONDS = 3600;

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Cloudflare R2 adapter (private bucket behind workers/r2-video).
 *
 * Signed URL shape:
 *   https://{R2_VIDEO_HOST}/{token}/{expires}{hls_path}
 * where
 *   token = base64url( HMAC_SHA256( R2_TOKEN_SECRET, `${dirPath}:${expires}` ) )
 * and dirPath is the parent directory of hls_path WITH trailing slash
 * (e.g. hls_path "/movies/tom-yum/master.m3u8" -> dirPath "/movies/tom-yum/").
 *
 * HLS playlists reference segments with relative paths, so every segment
 * request lands under the same /{token}/{expires}/ prefix. The worker
 * validates the token against each ancestor directory of the requested
 * object (deepest first), so variant playlists/segments in subdirectories
 * of dirPath are accepted by the same token. See workers/r2-video/src/index.ts.
 */
export const r2Provider: VideoProvider = {
  name: "r2",

  async getSignedPlaybackUrl(asset: VideoAsset): Promise<SignedPlayback> {
    const host = process.env.R2_VIDEO_HOST;
    const secret = process.env.R2_TOKEN_SECRET;
    if (!host || !secret) {
      // Орчны хувьсагч дутуу: R2_VIDEO_HOST (жиш. video.flimix.mn) болон
      // R2_TOKEN_SECRET (Worker-ийн secret-тэй ижил) тохируулах шаардлагатай.
      throw new Error(
        "Cloudflare R2 is not configured: set R2_VIDEO_HOST and R2_TOKEN_SECRET",
      );
    }

    const ttlRaw = Number(process.env.PLAYBACK_URL_TTL_SECONDS);
    const ttl =
      Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.floor(ttlRaw) : DEFAULT_TTL_SECONDS;

    const path = asset.hls_path.startsWith("/")
      ? asset.hls_path
      : `/${asset.hls_path}`;
    // Parent directory of the playlist, WITH trailing slash.
    const dirPath = path.slice(0, path.lastIndexOf("/") + 1);
    const expires = Math.floor(Date.now() / 1000) + ttl;

    const token = base64Url(
      createHmac("sha256", secret).update(`${dirPath}:${expires}`).digest(),
    );

    return {
      hlsUrl: `https://${host}/${token}/${expires}${path}`,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  },
};
