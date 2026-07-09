import "server-only";
import type { VideoAsset } from "@/types/db";
import { bunnyProvider } from "./bunny";
import { mockProvider } from "./mock";
import { r2Provider } from "./r2";
import type { SignedPlayback, VideoProvider } from "./types";

export type { SignedPlayback, VideoProvider } from "./types";

const providers: Partial<Record<VideoAsset["provider"], VideoProvider>> = {
  bunny: bunnyProvider,
  mock: mockProvider,
  r2: r2Provider,
};

/**
 * Contract entry point (see docs/CONVENTIONS.md):
 * turns a stored video asset into a signed, time-limited HLS URL.
 */
export async function getSignedPlaybackUrl(
  asset: VideoAsset,
): Promise<SignedPlayback> {
  const provider = providers[asset.provider];
  if (!provider) {
    throw new Error(`Unsupported video provider: ${asset.provider}`);
  }
  return provider.getSignedPlaybackUrl(asset);
}
