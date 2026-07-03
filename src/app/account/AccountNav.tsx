"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleUser,
  Users,
  Heart,
  History,
  Play,
  MonitorSmartphone,
  Crown,
  Receipt,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { t } from "@/lib/i18n";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const items: NavItem[] = [
  { href: "/account", label: t.myAccount, icon: CircleUser },
  { href: "/account/profiles", label: t.profiles, icon: Users },
  { href: "/account/favorites", label: t.favorites, icon: Heart },
  { href: "/account/history", label: t.watchHistory, icon: History },
  { href: "/account/continue", label: t.continueWatching, icon: Play },
  { href: "/account/devices", label: t.devices, icon: MonitorSmartphone },
  { href: "/account/subscription", label: t.subscription, icon: Crown },
  { href: "/account/payments", label: t.paymentHistory, icon: Receipt },
  { href: "/account/security", label: t.security, icon: ShieldCheck },
];

export function AccountNav({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/account") return pathname === "/account";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav aria-label="Бүртгэлийн цэс">
      {/* Mobile: horizontally scrollable tabs */}
      <div className="row-scroll -mx-1 flex gap-1 overflow-x-auto pb-2 lg:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition ${
              isActive(item.href)
                ? "border-royal-500/60 bg-royal-700/30 text-royal-300"
                : "border-ink-600 bg-ink-800 text-mist-300 hover:text-white"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
        <form action={signOutAction} className="shrink-0">
          <button
            type="submit"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-600 bg-ink-800 px-3.5 py-1.5 text-sm text-mist-300 transition hover:border-red-500/50 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t.signOut}
          </button>
        </form>
      </div>

      {/* Desktop: left sidebar */}
      <div className="hidden lg:flex lg:w-56 lg:flex-col lg:gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition ${
              isActive(item.href)
                ? "bg-royal-700/25 font-medium text-royal-300"
                : "text-mist-300 hover:bg-ink-800 hover:text-white"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
        <div className="my-2 h-px bg-ink-600/70" aria-hidden="true" />
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm text-mist-300 transition hover:bg-red-900/20 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t.signOut}
          </button>
        </form>
      </div>
    </nav>
  );
}
