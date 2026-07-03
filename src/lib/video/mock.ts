import "server-only";
import type { VideoAsset } from "@/types/db";
import type { SignedPlayback, VideoProvider } from "./types";

/** Public sample stream used when a mock asset has no absolute URL of its own. */
const SAMPLE_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const MOCK_TTL_SECONDS = 6 * 60 * 60;

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Local-development provider. If hls_path is already an absolute URL it is
 * returned as-is; otherwise a public sample HLS stream is used so the player
 * can be exercised without any CDN credentials.
 */
export const mockProvider: VideoProvider = {
  name: "mock",

  async getSignedPlaybackUrl(asset: VideoAsset): Promise<SignedPlayback> {
    const hlsUrl = isAbsoluteUrl(asset.hls_path) ? asset.hls_path : SAMPLE_HLS_URL;
    return {
      hlsUrl,
      expiresAt: new Date(Date.now() + MOCK_TTL_SECONDS * 1000).toISOString(),
    };
  },
};
