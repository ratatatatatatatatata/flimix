import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-display text-7xl font-bold text-royal-500">404</p>
      <h1 className="text-2xl font-semibold">{t.notFound}</h1>
      <p className="max-w-md text-mist-400">
        Таны хайсан хуудас олдсонгүй эсвэл өөр хаяг руу зөөгдсөн байна.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-royal-500 px-6 py-3 font-medium text-white transition hover:bg-royal-600"
      >
        {t.home} руу буцах
      </Link>
    </div>
  );
}
