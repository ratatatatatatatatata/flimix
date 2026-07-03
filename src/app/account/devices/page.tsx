import { cookies } from "next/headers";
import {
  HelpCircle,
  LogOut,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  Tv,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import type { UserDevice } from "@/types/db";
import { removeDevice, signOutAllDevices } from "./actions";

const DEVICE_COOKIE = "flimix_device_id";

const deviceIcons: Record<
  UserDevice["device_type"],
  React.ComponentType<{ className?: string }>
> = {
  web: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  tv: Tv,
  other: HelpCircle,
};

const deviceTypeLabels: Record<UserDevice["device_type"], string> = {
  web: "Вэб хөтөч",
  mobile: "Гар утас",
  tablet: "Таблет",
  tv: "Смарт ТВ",
  other: "Бусад",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Дөнгөж сая";
  if (minutes < 60) return `${minutes} минутын өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} өдрийн өмнө`;
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function DevicesPage() {
  const session = await requireUser();
  const supabase = await createClient();
  const cookieStore = await cookies();
  const currentDeviceId = cookieStore.get(DEVICE_COOKIE)?.value ?? null;

  const { data } = await supabase
    .from("user_devices")
    .select("*")
    .eq("user_id", session.userId)
    .order("last_active_at", { ascending: false });
  const devices = (data ?? []) as UserDevice[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.devices}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Бүртгэлд тань нэвтэрсэн төхөөрөмжүүд. Танихгүй төхөөрөмж байвал
          хасаад нууц үгээ солиорой.
        </p>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          title="Бүртгэлтэй төхөөрөмж алга"
          description="Кино үзэж эхлэхэд ашигласан төхөөрөмж энд бүртгэгдэнэ."
        />
      ) : (
        <ul className="space-y-3">
          {devices.map((device) => {
            const Icon = deviceIcons[device.device_type] ?? HelpCircle;
            const isCurrent =
              currentDeviceId !== null && device.id === currentDeviceId;
            return (
              <li
                key={device.id}
                className="flex items-center gap-4 rounded-xl border border-ink-600 bg-ink-800 p-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-royal-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-mist-100">
                      {device.device_name}
                    </p>
                    {isCurrent ? (
                      <Badge tone="accent">Энэ төхөөрөмж</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-mist-400">
                    {deviceTypeLabels[device.device_type]} · Сүүлд идэвхтэй:{" "}
                    {relativeTime(device.last_active_at)}
                  </p>
                </div>
                <form action={removeDevice}>
                  <input type="hidden" name="device_id" value={device.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`${device.device_name} төхөөрөмж хасах`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Хасах
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <section className="rounded-xl border border-red-500/30 bg-red-900/10 p-5">
        <h2 className="font-medium text-white">Бүх төхөөрөмжөөс гарах</h2>
        <p className="mt-1 text-sm text-mist-400">
          Бүх төхөөрөмж хасагдаж, бүх нэвтрэлт (энэ төхөөрөмж орно) хүчингүй
          болно. Дараа нь дахин нэвтрэх шаардлагатай.
        </p>
        <form action={signOutAllDevices} className="mt-4">
          <Button type="submit" variant="danger" size="sm">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Бүх төхөөрөмжөөс гаргах
          </Button>
        </form>
      </section>
    </div>
  );
}
