import { requireRole, hasRole } from "@/lib/auth";
import type { UserRole } from "@/types/db";
import { Badge } from "@/components/ui/Badge";
import { roleLabel } from "./_lib/format";
import { AdminSidebar, type AdminNavItem } from "./_components/AdminSidebar";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export const metadata = { title: "FLIMIX — Админ" };

const NAV: (AdminNavItem & { min: UserRole })[] = [
  { href: "/admin", label: "Хяналтын самбар", icon: "dashboard", min: "content_manager" },
  { href: "/admin/content", label: "Контент", icon: "film", min: "content_manager" },
  { href: "/admin/series", label: "Цуврал", icon: "tv", min: "content_manager" },
  { href: "/admin/rights", label: "Эрхийн удирдлага", icon: "scale", min: "admin" },
  { href: "/admin/users", label: "Хэрэглэгчид", icon: "users", min: "admin" },
  { href: "/admin/plans", label: "Багцууд", icon: "package", min: "admin" },
  { href: "/admin/homepage", label: "Нүүр хуудас", icon: "layout", min: "content_manager" },
  { href: "/admin/reports", label: "Тайлан", icon: "chart", min: "admin" },
  { href: "/admin/audit", label: "Аудит лог", icon: "scroll", min: "super_admin" },
  { href: "/admin/settings", label: "Тохиргоо", icon: "settings", min: "super_admin" },
];

const ROLE_ORDER: UserRole[] = ["super_admin", "admin", "content_manager", "user"];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Security gate: everything under /admin renders only after this check.
  const session = await requireRole("content_manager");

  const visible = NAV.filter((item) => hasRole(session, item.min));
  const topRole = ROLE_ORDER.find((r) => session.roles.includes(r)) ?? "user";

  return (
    <div className="min-h-screen bg-ink-950 text-mist-100">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-ink-700 bg-ink-900/95 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-lg font-semibold tracking-wide text-white">
            FLIMIX <span className="text-royal-400">Админ</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-mist-400 sm:inline">{session.email ?? ""}</span>
          <Badge tone={topRole === "super_admin" ? "danger" : topRole === "admin" ? "accent" : "default"}>
            {roleLabel[topRole]}
          </Badge>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-mist-300 transition hover:border-royal-500/60 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Сайт руу буцах
          </Link>
        </div>
      </header>

      <div className="lg:flex">
        <aside className="shrink-0 border-ink-700 bg-ink-900/60 lg:min-h-[calc(100vh-57px)] lg:w-60 lg:border-r">
          <AdminSidebar items={visible.map(({ href, label, icon }) => ({ href, label, icon }))} />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
