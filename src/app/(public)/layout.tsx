import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

/**
 * Public marketing/catalog area — fixed global header + footer around each
 * page. The header is fixed (overlaying the landing billboard), so the main
 * area reserves its height; the landing page pulls the billboard back up
 * under the header with a matching negative margin.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pt-16">{children}</main>
      <SiteFooter />
    </>
  );
}
