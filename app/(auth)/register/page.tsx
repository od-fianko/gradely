import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/register-form";
import { AuthTabs } from "@/features/auth/components/auth-tabs";

export const metadata: Metadata = { title: "Create account — Gradely" };

export default function RegisterPage() {
  return (
    <div>
      <AuthTabs />
      <div className="rounded-2xl border border-zinc-200 bg-white px-7 py-[30px] shadow-[0_1px_3px_rgba(16,24,40,.04),0_12px_32px_-12px_rgba(16,24,40,.10)]">
        <RegisterForm />
      </div>
    </div>
  );
}
