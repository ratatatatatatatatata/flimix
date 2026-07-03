import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Шинэ нууц үг — FLIMIX" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
