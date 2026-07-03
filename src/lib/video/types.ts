import "server-only";
import type { VideoAsset } from "@/types/db";

/** Signed, time-limited playback descriptor returned to the playback API. */
export interface SignedPlayback {
  hlsUrl: string;
  /** ISO timestamp after which the URL is no longer valid. */
  expiresAt: string;
}

/** A streaming backend capable of turning a stored asset into a playable URL. */
export interface VideoProvider {
  /** Matches video_assets.provider */
  readonly name: VideoAsset["provider"];
  getSignedPlaybackUrl(asset: VideoAsset): Promise<SignedPlayback>;
}
