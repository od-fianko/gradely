"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Mail } from "lucide-react";
import {
  startRegisterSchema, type StartRegisterSchema,
  completeRegisterSchema, type CompleteRegisterSchema,
} from "@/features/auth/schemas/auth.schema";
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
import Link from "next/link";

type Step = "email" | "otp" | "profile" | "done";

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "email",   label: "Email" },
  { key: "otp",     label: "Verify" },
  { key: "profile", label: "Details" },
];

function StepIndicator({ step }: { step: Step }) {
  const activeIndex = STEP_LABELS.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEP_LABELS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2 flex-1">
          <div className={`flex items-center gap-2 ${i <= activeIndex ? "text-blue-600" : "text-muted-foreground"}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              i < activeIndex ? "bg-blue-600 text-white" : i === activeIndex ? "bg-blue-100 text-blue-700 border-2 border-blue-600" : "bg-muted text-muted-foreground"
            }`}>
              {i < activeIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <div className={`h-0.5 flex-1 rounded ${i < activeIndex ? "bg-blue-600" : "bg-muted"}`} />}
        </div>
      ))}
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Step 1: email ────────────────────────────────────────────────────────────
  const emailForm = useForm<StartRegisterSchema>({
    resolver: zodResolver(startRegisterSchema),
    defaultValues: { email: "" },
  });

  const submitEmail = async (data: StartRegisterSchema) => {
    setServerError(null);
    const res = await fetch("/api/auth/register/start", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { setServerError(json.error ?? "Could not start sign-up"); return; }
    setEmail(data.email);
    setStep("otp");
  };

  // ── Step 2: OTP ──────────────────────────────────────────────────────────────
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const submitCode = async () => {
    setServerError(null); setVerifying(true);
    const res = await fetch("/api/auth/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, code }),
    });
    const json = await res.json();
    setVerifying(false);
    if (!res.ok) { setServerError(json.error ?? "Verification failed"); return; }
    profileForm.setValue("email", email);
    setStep(json.data.needsProfile ? "profile" : "done");
  };

  const resendCode = async () => {
    setServerError(null); setResending(true);
    const res = await fetch("/api/auth/resend", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    const json = await res.json();
    setResending(false);
    if (!res.ok) { setServerError(json.error ?? "Could not resend code"); return; }
  };

  // ── Step 3: profile + password ────────────────────────────────────────────────
  const profileForm = useForm<CompleteRegisterSchema>({
    resolver: zodResolver(completeRegisterSchema),
    defaultValues: { email: "", name: "", level: 100, program: "", password: "", confirmPassword: "" },
  });

  // Arriving here from /verify-email after a fresh verification — the email
  // is already confirmed, so skip straight to finishing the profile. The
  // API still re-checks isVerified/password server-side either way.
  useEffect(() => {
    const paramEmail = params.get("email");
    if (paramEmail) {
      setEmail(paramEmail);
      profileForm.setValue("email", paramEmail);
      setStep("profile");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitProfile = async (data: CompleteRegisterSchema) => {
    setServerError(null);
    const res = await fetch("/api/auth/register/complete", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { setServerError(json.error ?? "Could not complete sign-up"); return; }
    setStep("done");
    setTimeout(() => router.push("/login"), 1200);
  };

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <p className="font-semibold text-foreground">Account created!</p>
        <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator step={step} />

      {serverError && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-5">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* ── STEP 1: email ── */}
      {step === "email" && (
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(submitEmail)} className="space-y-5">
            <FormField control={emailForm.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>University email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@university.edu" autoComplete="email"
                    disabled={emailForm.formState.isSubmitting} className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={emailForm.formState.isSubmitting} className="w-full h-11 font-medium">
              {emailForm.formState.isSubmitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code…</>
                : "Continue"}
            </Button>
          </form>
        </Form>
      )}

      {/* ── STEP 2: OTP ── */}
      {step === "otp" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
            <Mail className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              We sent a 6-digit code to <span className="font-medium">{email}</span>. Enter it below to verify your email.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Verification code</label>
            <Input placeholder="123456" value={code} maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-11 mt-1.5 tracking-widest font-mono text-center" disabled={verifying} />
          </div>
          <Button onClick={submitCode} disabled={verifying || code.length !== 6} className="w-full h-11 font-medium">
            {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : "Verify email"}
          </Button>
          <Button type="button" variant="outline" onClick={resendCode} disabled={resending} className="w-full h-11">
            {resending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resending…</> : "Resend code"}
          </Button>
        </div>
      )}

      {/* ── STEP 3: name, level, program, password ── */}
      {step === "profile" && (
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(submitProfile)} className="space-y-5">
            <FormField control={profileForm.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl><Input placeholder="Ama Mensah" disabled={profileForm.formState.isSubmitting} className="h-11" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={profileForm.control} name="level" render={({ field }) => (
                <FormItem>
                  <FormLabel>Level</FormLabel>
                  <FormControl><Input type="number" min={100} max={900} placeholder="100" disabled={profileForm.formState.isSubmitting} className="h-11" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={profileForm.control} name="program" render={({ field }) => (
                <FormItem>
                  <FormLabel>Program <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="Computer Science" disabled={profileForm.formState.isSubmitting} className="h-11" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={profileForm.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="Min 8 chars, 1 uppercase, 1 number"
                      disabled={profileForm.formState.isSubmitting} className="h-11 pr-10" {...field} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={profileForm.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showConfirm ? "text" : "password"} placeholder="Repeat password"
                      disabled={profileForm.formState.isSubmitting} className="h-11 pr-10" {...field} />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" disabled={profileForm.formState.isSubmitting} className="w-full h-11 font-medium">
              {profileForm.formState.isSubmitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</>
                : "Complete sign-up"}
            </Button>
          </form>
        </Form>
      )}

      {step === "email" && (
        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
        </p>
      )}
    </div>
  );
}
