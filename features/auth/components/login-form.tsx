"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import Link from "next/link";
import { loginSchema, type LoginSchema } from "@/features/auth/schemas/auth.schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const DEMO_ACCOUNTS = [
  { role: "Admin",    email: "admin@gradely.edu" },
  { role: "Lecturer", email: "dr.mensah@gradely.edu" },
  { role: "Student",  email: "alice@student.gradely.edu" },
];

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginSchema) => {
    setServerError(null);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error === "not_verified") {
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
      return;
    }
    if (result?.error) {
      setServerError("Invalid email or password. Please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  const isLoading = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {serverError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12.5px] font-semibold text-zinc-700">Email address</FormLabel>
              <FormControl>
                <input
                  type="email"
                  placeholder="you@university.edu"
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full rounded-[9px] border border-zinc-300 bg-white px-[13px] py-[11px] text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12.5px] font-semibold text-zinc-700">Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full rounded-[9px] border border-zinc-300 bg-white px-[13px] py-[11px] pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-[9px] bg-primary py-3 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Signing in…</span>
          ) : (
            "Sign in"
          )}
        </button>

        {/* Demo accounts */}
        <div>
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-0.5 py-2 text-left"
          >
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-zinc-400">Demo accounts</span>
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${demoOpen ? "rotate-180" : ""}`} />
          </button>
          {demoOpen && (
            <div className="mt-0.5 rounded-[10px] border border-zinc-200 bg-zinc-50 p-2.5">
              {DEMO_ACCOUNTS.map(({ role, email }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => {
                    form.setValue("email", email);
                    form.setValue("password", "password123");
                    setDemoOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left transition-colors hover:bg-zinc-100"
                >
                  <span className="text-[12.5px] text-zinc-700"><span className="font-semibold">{role}:</span> {email}</span>
                  <span className="text-[11px] text-zinc-400">Click to fill</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="pt-1 text-center text-[13.5px] text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-primary hover:text-primary/80">Sign up</Link>
        </p>
      </form>
    </Form>
  );
}
