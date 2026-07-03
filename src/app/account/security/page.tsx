import Link from "next/link";
import { KeyRound, Mail, MonitorSmartphone, UserX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { ChangeEmailForm, ChangePasswordForm } from "./SecurityForms";

export default async function SecurityPage() {
  const session = await requireUser();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.security}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Нэвтрэлт болон бүртгэлийн аюулгүй байдлын тохиргоо.
        </p>
      </div>

      <section className="rounded-xl border border-ink-600 bg-ink-800 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-700 text-royal-300">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="font-medium text-white">Нууц үг солих</h2>
        </div>
        <div className="max-w-sm">
          <ChangePasswordForm />
        </div>
      </section>

      <section className="rounded-xl border border-ink-600 bg-ink-800 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-700 text-royal-300">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-medium text-white">Имэйл солих</h2>
            <p className="text-xs text-mist-400">
              Одоогийн хаяг: {session.email ?? "—"}
            </p>
          </div>
        </div>
        <div className="max-w-sm">
          <ChangeEmailForm currentEmail={session.email ?? ""} />
        </div>
        <p className="mt-3 text-xs text-mist-500">
          Шинэ имэйл хаягийг баталгаажуулсны дараа өөрчлөлт бүрэн хүчинтэй
          болно.
        </p>
      </section>

      <section className="rounded-xl border border-ink-600 bg-ink-800 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-700 text-royal-300">
            <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-medium text-white">Идэвхтэй нэвтрэлтүүд</h2>
            <p className="text-xs text-mist-400">
              Нэвтэрсэн төхөөрөмжүүдээ хянаж, шаардлагатай бол бүгдийг нь
              гаргах боломжтой.
            </p>
          </div>
        </div>
        <Link
          href="/account/devices"
          className="mt-4 inline-block text-sm font-medium text-royal-300 hover:text-royal-400"
        >
          Төхөөрөмжүүдээ харах →
        </Link>
      </section>

      <section className="rounded-xl border border-red-500/30 bg-red-900/10 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-900/40 text-red-300">
            <UserX className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="font-medium text-white">Бүртгэл устгах хүсэлт</h2>
        </div>
        <p className="mt-3 text-sm text-mist-400">
          Бүртгэл устгах нь эргэлт буцалтгүй үйлдэл тул аюулгүй байдлын үүднээс
          хүсэлтийг дэмжлэгийн багаар баталгаажуулж гүйцэтгэдэг. Бүртгэлтэй
          имэйл хаягаасаа доорх хаяг руу хүсэлт илгээнэ үү — ажлын 3 хоногийн
          дотор шийдвэрлэнэ.
        </p>
        <a
          href="mailto:support@flimix.mn?subject=Бүртгэл устгах хүсэлт"
          className="mt-4 inline-block text-sm font-medium text-red-300 hover:text-red-200"
        >
          support@flimix.mn
        </a>
      </section>
    </div>
  );
}
