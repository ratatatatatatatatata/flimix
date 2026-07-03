"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { t } from "@/lib/i18n";

const emailSchema = z.string().trim().email("Имэйл хаяг буруу байна");

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setLoading(true);
    const supabase = createClient();
    // Result intentionally ignored: always show success to prevent
    // user enumeration.
    await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-royal-700/30">
          <MailCheck className="h-7 w-7 text-royal-300" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-white">Имэйлээ шалгана уу</h1>
        <p className="text-sm leading-relaxed text-mist-300">
          Хэрэв энэ имэйл хаяг бүртгэлтэй бол нууц үг сэргээх холбоос
          илгээгдсэн. Хэрэв ирээгүй бол спам хавтсаа шалгаарай.
        </p>
        <Link href="/login" className="block">
          <Button type="button" variant="secondary" className="w-full">
            {t.signIn} хуудас руу буцах
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">{t.resetPassword}</h1>
        <p className="text-sm text-mist-400">
          Бүртгэлтэй имэйл хаягаа оруулбал нууц үг сэргээх холбоос илгээнэ.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label={t.email}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="tanii@mail.mn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
        />
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Холбоос илгээх
        </Button>
      </form>
      <p className="text-center text-sm text-mist-400">
        Нууц үгээ санав уу?{" "}
        <Link
          href="/login"
          className="font-medium text-royal-300 hover:text-royal-400"
        >
          {t.signIn}
        </Link>
      </p>
    </div>
  );
}
