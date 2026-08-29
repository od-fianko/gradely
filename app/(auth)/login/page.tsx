import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";
import { AuthTabs } from "@/features/auth/components/auth-tabs";

export const metadata: Metadata = { title: "Sign in — Gradely" };

export default function LoginPage() {
  return (
    <div>
      <AuthTabs />
      <div className="rounded-2xl border border-zinc-200 bg-white px-7 py-[30px] shadow-[0_1px_3px_rgba(16,24,40,.04),0_12px_32px_-12px_rgba(16,24,40,.10)]">
        <h1 className="text-[19px] font-bold text-zinc-900">Welcome back</h1>
        <p className="mb-[22px] mt-1 text-[13.5px] text-zinc-500">Sign in to your Gradely account</p>
        <LoginForm />
      </div>
    </div>
  );
}
