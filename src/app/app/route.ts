import { NextRequest, NextResponse } from "next/server";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=mn.flimix.app";
// App Store гарсны дараа энд линкээ тавина:
const APP_STORE_URL: string | null = null;

/**
 * Smart app link — QR кодын бай: /app
 * - Android: Play Store listing руу (апп суусан бол Android App Links
 *   ачаар flimix.mn линк шууд апп дотор нээгддэг)
 * - iOS: App Store (гартал нүүр хуудас)
 * - Бусад: нүүр хуудас
 */
export function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";

  if (/android/i.test(ua)) {
    return NextResponse.redirect(PLAY_STORE_URL, 302);
  }
  if (/iphone|ipad|ipod/i.test(ua) && APP_STORE_URL) {
    return NextResponse.redirect(APP_STORE_URL, 302);
  }
  return NextResponse.redirect(new URL("/", req.url), 302);
}
