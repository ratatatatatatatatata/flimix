import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FLIMIX — Монгол кино стриминг",
    template: "%s | FLIMIX",
  },
  description:
    "FLIMIX — Монгол болон дэлхийн шилдэг кино, цувралуудыг нэг дороос. Хадмал орчуулгатай, өндөр чанартай стриминг.",
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
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
