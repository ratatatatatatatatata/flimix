import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Имэйл баталгаажуулалт — FLIMIX" };

export default function VerifyEmailPage() {
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-royal-700/30">
        <MailCheck className="h-7 w-7 text-royal-300" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold text-white">{t.emailVerification}</h1>
      <p className="text-sm leading-relaxed text-mist-300">
        Бүртгэлээ идэвхжүүлэхийн тулд имэйл хаяг руугаа илгээсэн
        баталгаажуулах холбоос дээр дарна уу. Холбоос ирээгүй бол спам
        хавтсаа шалгаарай — заримдаа хэдэн минут зарцуулагддаг.
      </p>
      <div className="space-y-3">
        <Link href="/login" className="block">
          <Button type="button" className="w-full">
            {t.signIn}
          </Button>
        </Link>
        <p className="text-xs text-mist-500">
          Асуудал гарвал{" "}
          <a
            href="mailto:support@flimix.mn"
            className="text-royal-300 hover:text-royal-400"
          >
            support@flimix.mn
          </a>{" "}
          хаягаар холбогдоно уу.
        </p>
      </div>
    </div>
  );
}
