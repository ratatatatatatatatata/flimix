"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Film,
  Tv,
  Scale,
  Users,
  Package,
  LayoutTemplate,
  BarChart3,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  film: Film,
  tv: Tv,
  scale: Scale,
  users: Users,
  package: Package,
  layout: LayoutTemplate,
  chart: BarChart3,
  scroll: ScrollText,
  settings: Settings,
};

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
}

export function AdminSidebar({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Админ цэс"
      className="flex gap-1 overflow-x-auto border-b border-ink-700 px-2 py-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-3 lg:py-4"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-royal-700/30 text-royal-300"
                : "text-mist-400 hover:bg-ink-800 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
