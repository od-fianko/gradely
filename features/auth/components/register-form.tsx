"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Mail } from "lucide-react";
import {
  startRegisterSchema, type StartRegisterSchema,
  completeRegisterSchema, type CompleteRegisterSchema,
  LEVELS,
} from "@/features/auth/schemas/auth.schema";
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

const STEP_COPY: Record<Exclude<Step, "done">, { heading: string; subheading: string }> = {
  email:   { heading: "Create your account", subheading: "Start setting assignments in minutes" },
  otp:     { heading: "Verify your email", subheading: "Enter the code we just sent you" },
  profile: { heading: "Finish setting up", subheading: "Just a few more details" },
};

const inputClass = "w-full rounded-[9px] border border-zinc-300 bg-white px-[13px] py-[11px] text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "text-[12.5px] font-semibold text-zinc-700";
const primaryButtonClass = "w-full rounded-[9px] bg-primary py-3 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-zinc-300";
const secondaryButtonClass = "w-full rounded-[9px] border border-zinc-300 bg-white py-3 text-[14.5px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["email", "otp", "profile"];
  const activeIndex = order.indexOf(step);
  return (
    <div className="mb-5 flex items-center gap-1.5">
      {order.map((s, i) => (
        <div key={s} className="h-1.5 flex-1 rounded-full transition-colors"
          style={{ background: i <= activeIndex ? "hsl(var(--primary))" : "#e4e4e7" }} />
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
    defaultValues: { email: "", role: "STUDENT", name: "", level: 100, program: "", password: "", confirmPassword: "" },
  });
  const profileRole = profileForm.watch("role");

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
        <p className="font-semibold text-zinc-900">Account created!</p>
        <p className="text-sm text-zinc-500">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[19px] font-bold text-zinc-900">{STEP_COPY[step].heading}</h1>
      <p className="mb-[22px] mt-1 text-[13.5px] text-zinc-500">{STEP_COPY[step].subheading}</p>

      <StepDots step={step} />

      {serverError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* ── STEP 1: email ── */}
      {step === "email" && (
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(submitEmail)} className="space-y-4">
            <FormField control={emailForm.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>University email</FormLabel>
                <FormControl>
                  <input type="email" placeholder="you@university.edu" autoComplete="email"
                    disabled={emailForm.formState.isSubmitting} className={inputClass} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <button type="submit" disabled={emailForm.formState.isSubmitting} className={primaryButtonClass}>
              {emailForm.formState.isSubmitting
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sending code…</span>
                : "Continue"}
            </button>
          </form>
        </Form>
      )}

      {/* ── STEP 2: OTP ── */}
      {step === "otp" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-zinc-700">
              We sent a 6-digit code to <span className="font-semibold">{email}</span>.
            </p>
          </div>
          <div>
            <label className={labelClass}>Verification code</label>
            <input placeholder="123456" value={code} maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} mt-1.5 text-center font-mono tracking-[0.3em]`} disabled={verifying} />
          </div>
          <button onClick={submitCode} disabled={verifying || code.length !== 6} className={primaryButtonClass}>
            {verifying ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Verifying…</span> : "Verify email"}
          </button>
          <button type="button" onClick={resendCode} disabled={resending} className={secondaryButtonClass}>
            {resending ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Resending…</span> : "Resend code"}
          </button>
        </div>
      )}

      {/* ── STEP 3: name, level, program, password ── */}
      {step === "profile" && (
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(submitProfile)} className="space-y-4">
            <FormField control={profileForm.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>I am a</FormLabel>
                <FormControl>
                  <div className="grid grid-cols-2 gap-2">
                    {(["STUDENT", "LECTURER"] as const).map((r) => (
                      <button
                        key={r} type="button" onClick={() => field.onChange(r)}
                        disabled={profileForm.formState.isSubmitting}
                        className={`rounded-[9px] border py-2.5 text-sm font-semibold transition-colors ${
                          field.value === r
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50"
                        }`}
                      >
                        {r === "STUDENT" ? "Student" : "Lecturer"}
                      </button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={profileForm.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>Full name</FormLabel>
                <FormControl><input placeholder="Ama Mensah" disabled={profileForm.formState.isSubmitting} className={inputClass} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className={profileRole === "STUDENT" ? "grid grid-cols-2 gap-3" : ""}>
              {profileRole === "STUDENT" && (
                <FormField control={profileForm.control} name="level" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Level</FormLabel>
                    <FormControl>
                      <select disabled={profileForm.formState.isSubmitting} className={inputClass}
                        value={field.value ?? ""} onChange={(e) => field.onChange(Number(e.target.value))}>
                        {LEVELS.map((l) => <option key={l} value={l}>Level {l}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={profileForm.control} name="program" render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>
                    {profileRole === "LECTURER" ? "Department" : "Program"} <span className="font-normal text-zinc-400">(optional)</span>
                  </FormLabel>
                  <FormControl><input placeholder="Computer Science" disabled={profileForm.formState.isSubmitting} className={inputClass} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={profileForm.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} placeholder="Min 8 chars, 1 uppercase, 1 number"
                      disabled={profileForm.formState.isSubmitting} className={`${inputClass} pr-10`} {...field} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={profileForm.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel className={labelClass}>Confirm password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} placeholder="Repeat password"
                      disabled={profileForm.formState.isSubmitting} className={`${inputClass} pr-10`} {...field} />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600" tabIndex={-1}>
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <button type="submit" disabled={profileForm.formState.isSubmitting} className={primaryButtonClass}>
              {profileForm.formState.isSubmitting
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating account…</span>
                : "Complete sign-up"}
            </button>
          </form>
        </Form>
      )}

      {step === "email" && (
        <p className="mt-5 text-center text-[13.5px] text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:text-primary/80">Sign in</Link>
        </p>
      )}
    </div>
  );
}
