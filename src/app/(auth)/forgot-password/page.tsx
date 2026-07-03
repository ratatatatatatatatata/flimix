import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Нууц үг сэргээх — FLIMIX" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
