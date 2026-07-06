import { Suspense } from "react";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getSession } from "@/lib/auth";

/**
 * Public marketing/catalog area — fixed global header + footer around each
 * page. The header is fixed (overlaying the landing billboard), so the main
 * area reserves its height; the landing page pulls the billboard back up
 * under the header with a matching negative margin. On phones a fixed bottom
 * tab bar is added, so main also reserves bottom space below md.
 */
export default async function PublicLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  const session = await getSession();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pb-16 pt-16 md:pb-0">{children}</main>
      {modal}
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav isLoggedIn={session !== null} />
      </Suspense>
    </>
  );
}
