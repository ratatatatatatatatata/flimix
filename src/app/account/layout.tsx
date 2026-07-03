import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { AccountNav } from "./AccountNav";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Миний бүртгэл — FLIMIX" };

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <div className="min-h-screen bg-ink-950">
      <div className="container-fx py-8 lg:py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <aside className="shrink-0">
            <AccountNav signOutAction={signOutAction} />
          </aside>
          <main className="min-w-0 flex-1 animate-fade-in">{children}</main>
        </div>
      </div>
    </div>
  );
}
