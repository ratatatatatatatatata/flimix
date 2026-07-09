/**
 * FLIMIX R2 video worker.
 *
 * Serves HLS files from a PRIVATE R2 bucket behind HMAC path tokens:
 *
 *   GET https://video.flimix.mn/{token}/{expires}/{...objectPath}
 *
 *   token = base64url( HMAC_SHA256( R2_TOKEN_SECRET, `${dirPath}:${expires}` ) )
 *
 * where dirPath is an ancestor directory (with leading AND trailing slash)
 * of the requested object. The app signs over dirname(hls_path) + "/"
 * (the directory containing master.m3u8); because HLS playlists reference
 * segments with relative paths, every playlist/segment request arrives under
 * the same /{token}/{expires}/ prefix, and this worker accepts the token if
 * it matches ANY ancestor directory of the requested object (deepest first).
 * That makes variant playlists/segments in subdirectories work with the same
 * token, at the cost of a handful of HMAC operations per request.
 *
 * Zero egress cost: Worker <-> R2 traffic is free; responses are additionally
 * cached at the edge, keyed WITHOUT the token prefix so URLs signed for
 * different users hit the same cache entry.
 */

export interface Env {
  VIDEOS: R2Bucket;
  R2_TOKEN_SECRET: string;
}

const CONTENT_TYPES: Record<string, string> = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  m4s: "video/iso.segment",
  mp4: "video/mp4",
  vtt: "text/vtt",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Origin, Accept, Content-Type",
  "Access-Control-Expose-Headers":
    "Content-Range, Accept-Ranges, Content-Length, Content-Type, ETag",
  "Access-Control-Max-Age": "86400",
};

function base64Url(bytes: ArrayBuffer): string {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacToken(
  secret: string,
  message: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64Url(signature);
}

/** Constant-time string comparison (both sides encoded to bytes). */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= (aBytes[i] as number) ^ (bBytes[i] as number);
  }
  return diff === 0;
}

/**
 * Ancestor-directory rule: the token is valid if it matches
 * HMAC(secret, `${dir}:${expires}`) for ANY ancestor directory of the
 * requested object, checked from the deepest directory up to "/".
 * objectPath has no leading slash; dirs carry leading + trailing slashes.
 */
async function isTokenValid(
  secret: string,
  token: string,
  expires: number,
  objectPath: string,
): Promise<boolean> {
  const segments = objectPath.split("/").slice(0, -1); // drop the filename
  for (let depth = segments.length; depth >= 0; depth--) {
    const dir = `/${segments.slice(0, depth).join("/")}${depth > 0 ? "/" : ""}`;
    const expected = await hmacToken(secret, `${dir}:${expires}`);
    if (timingSafeEqual(token, expected)) return true;
  }
  return false;
}

interface ParsedRange {
  offset: number;
  length?: number;
  suffix?: number;
}

/** Parse a single-range "bytes=" header. Returns null for no/unsupported range. */
function parseRange(header: string | null): ParsedRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startRaw, endRaw] = match;
  if (startRaw === "" && endRaw === "") return null;
  if (startRaw === "") {
    return { offset: 0, suffix: Number(endRaw) };
  }
  const offset = Number(startRaw);
  if (endRaw === "") return { offset };
  const end = Number(endRaw);
  if (end < offset) return null;
  return { offset, length: end - offset + 1 };
}

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse(405, "Method not allowed");
    }

    const url = new URL(request.url);
    // /{token}/{expires}/{...objectPath}
    const parts = url.pathname.split("/").filter((p) => p.length > 0);
    if (parts.length < 3) {
      return errorResponse(404, "Not found");
    }
    const token = decodeURIComponent(parts[0] as string);
    const expires = Number(parts[1]);
    const objectPath = parts
      .slice(2)
      .map((p) => decodeURIComponent(p))
      .join("/");
    if (objectPath.includes("..")) {
      return errorResponse(403, "Forbidden");
    }

    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      return errorResponse(410, "Link expired");
    }
    if (!(await isTokenValid(env.R2_TOKEN_SECRET, token, expires, objectPath))) {
      return errorResponse(403, "Invalid token");
    }

    const extension = objectPath.split(".").pop()?.toLowerCase() ?? "";
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
    const isPlaylist = extension === "m3u8";
    const cacheControl = isPlaylist
      ? "public, max-age=60"
      : "public, max-age=31536000, immutable";

    const rangeHeader = request.headers.get("Range");
    const range = parseRange(rangeHeader);

    // Edge cache keyed WITHOUT the token/expires prefix so URLs signed for
    // different viewers share entries. Range is part of the key; only full
    // (200) responses are stored (the Cache API rejects 206 bodies).
    const cache = caches.default;
    const cacheKey = new Request(
      `https://${url.host}/__r2cache/${objectPath}${
        rangeHeader ? `?range=${encodeURIComponent(rangeHeader)}` : ""
      }`,
      { method: "GET" },
    );
    const cached = await cache.match(cacheKey);
    if (cached) {
      return request.method === "HEAD"
        ? new Response(null, { status: cached.status, headers: cached.headers })
        : cached;
    }

    const object = await env.VIDEOS.get(objectPath, {
      range: range
        ? range.suffix !== undefined
          ? { suffix: range.suffix }
          : range.length !== undefined
            ? { offset: range.offset, length: range.length }
            : { offset: range.offset }
        : undefined,
    });
    if (!object || !("body" in object)) {
      return errorResponse(404, "Not found");
    }

    const headers = new Headers(CORS_HEADERS);
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", cacheControl);
    headers.set("Accept-Ranges", "bytes");
    headers.set("ETag", object.httpEtag);

    let status = 200;
    if (range) {
      const size = object.size;
      let start: number;
      let end: number;
      if (range.suffix !== undefined) {
        start = Math.max(size - range.suffix, 0);
        end = size - 1;
      } else {
        start = range.offset;
        end =
          range.length !== undefined
            ? Math.min(range.offset + range.length - 1, size - 1)
            : size - 1;
      }
      if (start >= size) {
        headers.set("Content-Range", `bytes */${size}`);
        return new Response("Range not satisfiable", { status: 416, headers });
      }
      status = 206;
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
      headers.set("Content-Length", String(end - start + 1));
    } else {
      headers.set("Content-Length", String(object.size));
    }

    const response = new Response(
      request.method === "HEAD" ? null : object.body,
      { status, headers },
    );

    // Only full-body GET responses can go into the edge cache.
    if (request.method === "GET" && status === 200) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  },
};

export default worker;
