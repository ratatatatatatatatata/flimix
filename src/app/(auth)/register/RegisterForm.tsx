"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { t } from "@/lib/i18n";

const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Нэр хамгийн багадаа 2 тэмдэгт байна")
    .max(40, "Нэр хэт урт байна"),
  email: z.string().trim().email("Имэйл хаяг буруу байна"),
  password: z.string().min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой"),
  terms: z.literal(true, {
    errorMap: () => ({ message: "Үйлчилгээний нөхцөлийг зөвшөөрнө үү" }),
  }),
});

type FieldKey = "displayName" | "email" | "password" | "terms";
type FieldErrors = Partial<Record<FieldKey, string>>;

interface Strength {
  score: 0 | 1 | 2 | 3;
  label: string;
  barClass: string;
}

function passwordStrength(pw: string): Strength {
  if (pw.length === 0) return { score: 0, label: "", barClass: "bg-ink-600" };
  let points = 0;
  if (pw.length >= 8) points += 1;
  if (pw.length >= 12) points += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) points += 1;
  if (/\d/.test(pw)) points += 1;
  if (/[^A-Za-z0-9]/.test(pw)) points += 1;
  if (points <= 1) return { score: 1, label: "Сул", barClass: "bg-red-500" };
  if (points <= 3) return { score: 2, label: "Дунд", barClass: "bg-amber-400" };
  return { score: 3, label: "Сайн", barClass: "bg-emerald-400" };
}

export function RegisterForm({ next }: { next: string }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = passwordStrength(password);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse({
      displayName,
      email,
      password,
      terms,
    });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldKey;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: { display_name: parsed.data.displayName },
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setFormError("Энэ имэйл хаяг аль хэдийн бүртгэлтэй байна.");
      } else {
        setFormError("Бүртгэл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.");
      }
      return;
    }
    // Supabase returns a user with no identities when the email already exists.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setFormError("Энэ имэйл хаяг аль хэдийн бүртгэлтэй байна.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-royal-700/30">
          <MailCheck className="h-7 w-7 text-royal-300" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-white">Имэйлээ шалгана уу</h1>
        <p className="text-sm leading-relaxed text-mist-300">
          <span className="font-medium text-white">{email}</span> хаяг руу
          баталгаажуулах холбоос илгээлээ. Холбоос дээр дарж бүртгэлээ
          идэвхжүүлнэ үү. Хэрэв ирээгүй бол спам хавтсаа шалгаарай.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => (window.location.href = "/login")}
        >
          {t.signIn} хуудас руу очих
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">{t.signUp}</h1>
        <p className="text-sm text-mist-400">
          Хэдхэн секундэд бүртгэл үүсгээд Монголын шилдэг контентыг үзээрэй.
        </p>
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-300"
        >
          {formError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label={t.displayName}
          type="text"
          name="displayName"
          autoComplete="name"
          placeholder="Таны нэр"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors.displayName}
        />
        <Input
          label={t.email}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="tanii@mail.mn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <div className="space-y-2">
          <Input
            label={t.password}
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Дор хаяж 8 тэмдэгт"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          {password.length > 0 ? (
            <div className="space-y-1">
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`h-1 flex-1 rounded-full ${
                      strength.score >= step ? strength.barClass : "bg-ink-600"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-mist-400">
                Нууц үгийн бат бөх: {strength.label}
              </p>
            </div>
          ) : (
            <p className="text-xs text-mist-500">
              Том, жижиг үсэг, тоо хольж ашиглавал илүү найдвартай.
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-mist-300">
          <input
            type="checkbox"
            name="terms"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-600 bg-ink-800 accent-royal-500"
          />
          <span>
            <Link
              href="/legal/terms"
              target="_blank"
              className="text-royal-300 underline-offset-2 hover:underline"
            >
              {t.termsOfService}
            </Link>
            -ийг уншиж танилцан, зөвшөөрч байна.
          </span>
        </label>
        {fieldErrors.terms ? (
          <p className="text-sm text-red-400">{fieldErrors.terms}</p>
        ) : null}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {t.signUp}
        </Button>
      </form>

      <p className="text-center text-sm text-mist-400">
        {t.alreadyHaveAccount}{" "}
        <Link
          href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-royal-300 hover:text-royal-400"
        >
          {t.signIn}
        </Link>
      </p>
    </div>
  );
}
