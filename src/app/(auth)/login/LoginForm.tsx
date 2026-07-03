"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { t } from "@/lib/i18n";

const loginSchema = z.object({
  email: z.string().trim().email("Имэйл хаяг буруу байна"),
  password: z.string().min(1, "Нууц үгээ оруулна уу"),
});

type FieldErrors = Partial<Record<"email" | "password", string>>;

export function LoginForm({
  next,
  callbackError,
}: {
  next: string;
  callbackError: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(
    callbackError ? "Нэвтрэлт амжилтгүй боллоо. Дахин оролдоно уу." : null,
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      setLoading(false);
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setFormError("Имэйл хаягаа баталгаажуулаагүй байна. Имэйлээ шалгана уу.");
      } else {
        setFormError("Имэйл эсвэл нууц үг буруу байна.");
      }
      return;
    }
    // Full navigation so the refreshed session cookie is picked up everywhere.
    window.location.assign(next);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      setFormError("Google-ээр нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">{t.signIn}</h1>
        <p className="text-sm text-mist-400">Тавтай морил! Бүртгэлдээ нэвтэрнэ үү.</p>
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
          label={t.email}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="tanii@mail.mn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <div className="space-y-1.5">
          <Input
            label={t.password}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-royal-300 hover:text-royal-400"
            >
              {t.forgotPassword}
            </Link>
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full" size="lg">
          {t.signIn}
        </Button>
      </form>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-ink-600" />
        <span className="text-xs text-mist-500">эсвэл</span>
        <span className="h-px flex-1 bg-ink-600" />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        size="lg"
        loading={googleLoading}
        onClick={handleGoogle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 5.04c1.7 0 3.22.58 4.42 1.72l3.28-3.28C17.7 1.6 15.06.5 12 .5 7.4.5 3.44 3.13 1.5 6.96l3.85 2.99C6.27 7.1 8.9 5.04 12 5.04z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45c-.28 1.5-1.12 2.77-2.4 3.62l3.72 2.89c2.17-2.01 3.73-4.97 3.73-8.7z"
          />
          <path
            fill="#FBBC05"
            d="M5.35 14.05a7.05 7.05 0 0 1 0-4.1L1.5 6.96a11.53 11.53 0 0 0 0 10.08l3.85-2.99z"
          />
          <path
            fill="#34A853"
            d="M12 23.5c3.06 0 5.63-1.01 7.5-2.75l-3.72-2.89c-1.03.7-2.36 1.1-3.78 1.1-3.1 0-5.73-2.06-6.65-4.91L1.5 17.04C3.44 20.87 7.4 23.5 12 23.5z"
          />
        </svg>
        {t.continueWithGoogle}
      </Button>

      <p className="text-center text-sm text-mist-400">
        {t.noAccountYet}{" "}
        <Link
          href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-royal-300 hover:text-royal-400"
        >
          {t.signUp}
        </Link>
      </p>
    </div>
  );
}
