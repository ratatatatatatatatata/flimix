"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { t } from "@/lib/i18n";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Нууц үг таарахгүй байна",
  });

type SessionState = "checking" | "ready" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // The recovery link normally lands via /auth/callback which sets the
  // session cookie. Also handle a ?code= landing directly on this page.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function resolveSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setSessionState("ready");
        return;
      }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) setSessionState(error ? "invalid" : "ready");
        return;
      }
      setSessionState("invalid");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionState("ready");
      }
    });
    void resolveSession();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = passwordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const errs: { password?: string; confirm?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "password" || key === "confirm") errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      setLoading(false);
      setFormError(
        "Нууц үг солиход алдаа гарлаа. Холбоосын хугацаа дууссан байж болзошгүй.",
      );
      return;
    }
    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (sessionState === "checking") {
    return (
      <div className="flex flex-col items-center gap-4 py-8" role="status">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-royal-500/30 border-t-royal-500"
          aria-hidden="true"
        />
        <p className="text-sm text-mist-400">Холбоос шалгаж байна...</p>
      </div>
    );
  }

  if (sessionState === "invalid") {
    return (
      <div className="space-y-5 text-center">
        <h1 className="text-2xl font-bold text-white">Холбоос хүчингүй байна</h1>
        <p className="text-sm text-mist-300">
          Нууц үг сэргээх холбоосын хугацаа дууссан эсвэл аль хэдийн
          ашиглагдсан байна. Шинэ холбоос авна уу.
        </p>
        <Link href="/forgot-password" className="block">
          <Button type="button" className="w-full">
            Шинэ холбоос авах
          </Button>
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-900/40">
          <CheckCircle2 className="h-7 w-7 text-emerald-300" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-white">Нууц үг шинэчлэгдлээ</h1>
        <p className="text-sm text-mist-300">
          Шинэ нууц үгээрээ нэвтэрнэ үү. Нэвтрэх хуудас руу шилжүүлж байна...
        </p>
        <Link href="/login" className="block">
          <Button type="button" className="w-full">
            {t.signIn}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Шинэ нууц үг</h1>
        <p className="text-sm text-mist-400">
          Бүртгэлдээ ашиглах шинэ нууц үгээ оруулна уу.
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
          label="Шинэ нууц үг"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Дор хаяж 8 тэмдэгт"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <Input
          label="Нууц үг давтах"
          type="password"
          name="confirm"
          autoComplete="new-password"
          placeholder="Дахин оруулна уу"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm}
        />
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Нууц үг шинэчлэх
        </Button>
      </form>
    </div>
  );
}
