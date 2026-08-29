"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}

const inputClass = "w-full rounded-[9px] border border-zinc-300 bg-white px-[13px] py-[11px] text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "text-[12.5px] font-semibold text-zinc-700";
const primaryButtonClass = "w-full rounded-[9px] bg-primary py-3 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-zinc-300";
const secondaryButtonClass = "w-full rounded-[9px] border border-zinc-300 bg-white py-3 text-[14.5px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async () => {
    setVerifying(true); setError(null); setMessage(null);
    const res = await fetch("/api/auth/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, code }),
    });
    const json = await res.json();
    setVerifying(false);
    if (!res.ok) { setError(json.error ?? "Verification failed"); return; }
    if (json.data?.needsProfile) {
      setMessage("Email verified — redirecting you to finish creating your account…");
      setTimeout(() => router.push(`/register?email=${encodeURIComponent(email)}`), 1200);
      return;
    }
    setMessage("Email verified — redirecting you to sign in…");
    setTimeout(() => router.push("/login"), 1200);
  };

  const resend = async () => {
    setResending(true); setError(null); setMessage(null);
    const res = await fetch("/api/auth/resend", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    const json = await res.json();
    setResending(false);
    if (!res.ok) { setError(json.error ?? "Could not resend code"); return; }
    setMessage(json.message ?? "A new code has been sent");
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-7 py-[30px] shadow-[0_1px_3px_rgba(16,24,40,.04),0_12px_32px_-12px_rgba(16,24,40,.10)]">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <div className="rounded-full bg-primary/10 p-2.5">
          <MailCheck className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-[19px] font-bold text-zinc-900">Verify your email</h1>
        <p className="text-[13.5px] text-zinc-500">
          Enter the code sent to your university email to activate your account.
        </p>
      </div>

      <div className="space-y-4">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        {message && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
        )}

        <div>
          <label className={labelClass}>University email</label>
          <input type="email" placeholder="you@university.edu" value={email}
            onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-1.5`} disabled={verifying || resending} />
        </div>

        <div>
          <label className={labelClass}>Verification code</label>
          <input placeholder="123456" value={code} maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${inputClass} mt-1.5 text-center font-mono tracking-[0.3em]`} disabled={verifying || resending} />
        </div>

        <button onClick={verify} disabled={verifying || resending || !email || code.length !== 6} className={primaryButtonClass}>
          {verifying ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Verifying…</span> : "Verify email"}
        </button>
        <button onClick={resend} disabled={verifying || resending || !email} className={secondaryButtonClass}>
          {resending ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Resending…</span> : "Resend code"}
        </button>

        <p className="text-center text-[13.5px] text-zinc-500">
          Wrong account?{" "}
          <Link href="/register" className="font-semibold text-primary hover:text-primary/80">Sign up again</Link>
          {" · "}
          <Link href="/login" className="font-semibold text-primary hover:text-primary/80">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
