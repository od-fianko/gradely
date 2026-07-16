"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { loginSchema, type LoginSchema } from "@/features/auth/schemas/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

    if (result?.error) {
      setServerError("Invalid email or password. Please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  const isLoading = form.formState.isSubmitting;

  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur-sm p-8 shadow-xl shadow-blue-100/50">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your Gradely account</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* Server error */}
          {serverError && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 animate-slide-up">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium">Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@university.edu"
                    autoComplete="email"
                    disabled={isLoading}
                    className="h-11 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={isLoading}
                      className="h-11 pr-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <EyeOff className="h-4 w-4" />
                        : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-md shadow-blue-200 transition-all duration-200 hover:shadow-lg hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0"
            disabled={isLoading}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
            ) : (
              "Sign in"
            )}
          </Button>

          {/* Dev helper */}
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dev accounts</p>
            {[
              ["Admin",    "admin@gradely.edu"],
              ["Lecturer", "dr.mensah@gradely.edu"],
              ["Student",  "alice@student.gradely.edu"],
            ].map(([role, email]) => (
              <button
                key={email}
                type="button"
                onClick={() => {
                  form.setValue("email", email);
                  form.setValue("password", "password123");
                }}
                className="block w-full text-left text-xs text-slate-600 hover:text-blue-600 transition-colors py-0.5"
              >
                <span className="font-medium">{role}:</span> {email}
              </button>
            ))}
            <p className="text-xs text-slate-400 pt-0.5">Click any account to auto-fill</p>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-blue-600 font-medium hover:underline">Sign up</Link>
          </p>
        </form>
      </Form>
    </div>
  );
}
