"use client";

import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Нууц үг таарахгүй байна",
  });

const emailSchema = z.string().trim().email("Имэйл хаяг буруу байна");

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const parsed = passwordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const errs: { password?: string; confirm?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "password" || key === "confirm") errs[key] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      setMessage({
        tone: "error",
        text: "Нууц үг солиход алдаа гарлаа. Дахин оролдоно уу.",
      });
      return;
    }
    setPassword("");
    setConfirm("");
    setMessage({ tone: "success", text: "Нууц үг амжилттай солигдлоо." });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {message ? (
        <p
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.tone === "success"
              ? "border-emerald-700/40 bg-emerald-900/30 text-emerald-300"
              : "border-red-500/40 bg-red-900/30 text-red-300"
          }`}
        >
          {message.text}
        </p>
      ) : null}
      <Input
        label="Шинэ нууц үг"
        type="password"
        autoComplete="new-password"
        placeholder="Дор хаяж 8 тэмдэгт"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <Input
        label="Шинэ нууц үг давтах"
        type="password"
        autoComplete="new-password"
        placeholder="Дахин оруулна уу"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={errors.confirm}
      />
      <Button type="submit" loading={loading} size="sm">
        Нууц үг солих
      </Button>
    </form>
  );
}

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    if (parsed.data === currentEmail) {
      setFieldError("Одоогийн имэйлтэй ижил байна");
      return;
    }
    setFieldError(undefined);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser(
      { email: parsed.data },
      { emailRedirectTo: `${location.origin}/auth/callback?next=/account/security` },
    );
    setLoading(false);
    if (error) {
      setMessage({
        tone: "error",
        text: "Имэйл солиход алдаа гарлаа. Дахин оролдоно уу.",
      });
      return;
    }
    setEmail("");
    setMessage({
      tone: "success",
      text: "Шинэ имэйл хаяг руу баталгаажуулах холбоос илгээлээ. Баталгаажуулсны дараа өөрчлөлт хүчинтэй болно.",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {message ? (
        <p
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.tone === "success"
              ? "border-emerald-700/40 bg-emerald-900/30 text-emerald-300"
              : "border-red-500/40 bg-red-900/30 text-red-300"
          }`}
        >
          {message.text}
        </p>
      ) : null}
      <Input
        label="Шинэ имэйл хаяг"
        type="email"
        autoComplete="email"
        placeholder="shine@mail.mn"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldError}
      />
      <Button type="submit" loading={loading} size="sm" variant="secondary">
        Имэйл солих
      </Button>
    </form>
  );
}
