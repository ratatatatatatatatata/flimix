import "server-only";
import { createHash } from "node:crypto";
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
 * Bunny Stream adapter.
 *
 * Signs the HLS playlist path with Bunny CDN "token authentication":
 *   token = base64url( SHA256( token_auth_key + url_path + expires ) )
 * and appends ?token=...&expires=... to the CDN URL.
 *
 * NOTE: confirm the exact token recipe (parameter names, whether the path
 * includes a leading slash, directory-token variants, IP binding) against the
 * current Bunny CDN token-authentication documentation BEFORE production use.
 */
export const bunnyProvider: VideoProvider = {
  name: "bunny",

  async getSignedPlaybackUrl(asset: VideoAsset): Promise<SignedPlayback> {
    const hostname = process.env.BUNNY_STREAM_CDN_HOSTNAME;
    const tokenAuthKey = process.env.BUNNY_TOKEN_AUTH_KEY;
    if (!hostname || !tokenAuthKey) {
      throw new Error(
        "Bunny Stream is not configured: set BUNNY_STREAM_CDN_HOSTNAME and BUNNY_TOKEN_AUTH_KEY",
      );
    }

    const ttlRaw = Number(process.env.PLAYBACK_URL_TTL_SECONDS);
    const ttl =
      Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.floor(ttlRaw) : DEFAULT_TTL_SECONDS;

    const path = asset.hls_path.startsWith("/")
      ? asset.hls_path
      : `/${asset.hls_path}`;
    const expires = Math.floor(Date.now() / 1000) + ttl;

    const digest = createHash("sha256")
      .update(tokenAuthKey + path + String(expires))
      .digest();
    const token = base64Url(digest);

    return {
      hlsUrl: `https://${hostname}${path}?token=${token}&expires=${expires}`,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  },
};
