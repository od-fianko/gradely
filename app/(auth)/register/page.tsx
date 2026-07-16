import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Register — Gradely" };

export default function RegisterPage() {
  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur-sm p-8 shadow-xl shadow-blue-100/50">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
        <p className="text-sm text-muted-foreground mt-1">Join Gradely — learning made measurable</p>
      </div>
      <RegisterForm />
    </div>
  );
}
