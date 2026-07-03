import { Logo } from "@/components/brand/Logo";

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
            "radial-gradient(ellipse 60% 45% at 50% 0%, rgba(139,92,246,0.16), transparent 70%), radial-gradient(ellipse 50% 40% at 85% 100%, rgba(139,92,246,0.08), transparent 70%)",
        }}
      />
      <div className="relative z-10 mb-8">
        <Logo />
      </div>
      <main className="relative z-10 w-full max-w-md animate-fade-in rounded-2xl border border-ink-600/60 bg-ink-900/80 p-6 shadow-card backdrop-blur sm:p-8">
        {children}
      </main>
      <p className="relative z-10 mt-8 text-xs text-mist-500">
        © {new Date().getFullYear()} FLIMIX. Бүх эрх хуулиар хамгаалагдсан.
      </p>
    </div>
  );
}
