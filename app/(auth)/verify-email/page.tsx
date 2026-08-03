"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}

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
    <div className="rounded-2xl border bg-card/80 backdrop-blur-sm p-8 shadow-xl shadow-blue-100/50">
      <div className="mb-6 flex flex-col items-center text-center gap-2">
        <div className="rounded-full bg-primary/10 p-3">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Verify your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to your university email. Enter it below to activate your account.
        </p>
      </div>

      <div className="space-y-4">
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}
        {message && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">{message}</p>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700">University email</label>
          <Input type="email" placeholder="you@university.edu" value={email}
            onChange={(e) => setEmail(e.target.value)} className="h-11 mt-1.5" disabled={verifying || resending} />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Verification code</label>
          <Input placeholder="123456" value={code} maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-11 mt-1.5 tracking-widest font-mono text-center" disabled={verifying || resending} />
        </div>

        <Button onClick={verify} disabled={verifying || resending || !email || code.length !== 6} className="w-full h-11 font-medium">
          {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : "Verify email"}
        </Button>
        <Button variant="outline" onClick={resend} disabled={verifying || resending || !email} className="w-full h-11">
          {resending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resending…</> : "Resend code"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Wrong account?{" "}
          <Link href="/register" className="text-blue-600 font-medium hover:underline">Sign up again</Link>
          {" · "}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
