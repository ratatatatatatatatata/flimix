import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { RegisterSW } from "@/components/pwa/RegisterSW";
import "./globals.css";

// Inter for body (excellent Cyrillic), Manrope for display/headings.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FLIMIX — Монгол кино стриминг",
    template: "%s | FLIMIX",
  },
  description:
    "FLIMIX — Монгол болон дэлхийн шилдэг кино, цувралуудыг нэг дороос. Хадмал орчуулгатай, өндөр чанартай стриминг.",
  applicationName: "FLIMIX",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FLIMIX",
  },
};

export const viewport: Viewport = {
  themeColor: "#07060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mn" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
