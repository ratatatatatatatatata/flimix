import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "mn.flimix.app",
  appName: "FLIMIX",
  webDir: "www",
  // Load the live site inside the native shell
  server: {
    url: "https://flimix.mn",
    allowNavigation: ["flimix.mn", "*.flimix.mn", "*.supabase.co", "*.b-cdn.net"],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#07060a",
  },
};

export default config;
