import { Logo } from "@/components/brand/Logo";
import { AuthCard } from "./AuthCard";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      {/* Cinematic royal glow backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 0%, rgba(139,92,246,0.16), transparent 70%), radial-gradient(ellipse 50% 40% at 85% 100%, rgba(224,107,240,0.09), transparent 70%)",
        }}
      />
      <div className="relative z-10 mb-8">
        <Logo size="lg" />
      </div>
      <AuthCard>{children}</AuthCard>
      <p className="relative z-10 mt-8 text-xs text-mist-500">
        © {new Date().getFullYear()} FLIMIX. Бүх эрх хуулиар хамгаалагдсан.
      </p>
    </div>
  );
}
