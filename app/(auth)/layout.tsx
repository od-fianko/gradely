import { AuthShowcase } from "@/features/auth/components/auth-showcase";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <AuthShowcase />

      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f9] px-6 py-10">
        <div className="w-full max-w-[394px]">
          {/* Mobile-only brand mark — the showcase panel is hidden below lg */}
          <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <span className="font-serif text-lg font-bold text-zinc-900">Gradely</span>
          </div>

          {children}

          <p className="mt-5 text-center text-xs text-zinc-400">© {new Date().getFullYear()} Gradely. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
