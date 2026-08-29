"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthTabs() {
  const pathname = usePathname();
  const isSignUp = pathname?.startsWith("/register");

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-center text-[13.5px] font-medium transition-all ${
      active ? "bg-white text-zinc-900 font-bold shadow-sm" : "text-zinc-500 hover:text-zinc-700"
    }`;

  return (
    <div className="mb-5 flex rounded-[10px] bg-zinc-200/70 p-[3px]">
      <Link href="/login" className={tabClass(!isSignUp)}>Sign in</Link>
      <Link href="/register" className={tabClass(!!isSignUp)}>Create account</Link>
    </div>
  );
}
