import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "mn.flimix.app",
  appName: "FLIMIX",
  webDir: "www",
  // Load the live site inside the native shell. Use the canonical www host the
  // site redirects to, so the WebView doesn't hit a cross-host redirect on boot.
  server: {
    url: "https://www.flimix.mn",
    allowNavigation: [
      "flimix.mn",
      "*.flimix.mn",
      "*.supabase.co",
      "*.b-cdn.net",
      "*.mediadelivery.net",
      "accounts.google.com",
    ],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#07060a",
  },
};

export default config;
