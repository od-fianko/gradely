"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { navByRole, type NavItem } from "./nav-items";
import { cn } from "@/lib/utils/cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type SidebarUser = {
  name:  string;
  email: string;
  role:  string;
  image: string | null;
};

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const navItems: NavItem[] = navByRole[user.role] ?? [];

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleLabel =
    user.role === "ADMIN"    ? "Administrator" :
    user.role === "LECTURER" ? "Lecturer"      : "Student";

  const roleColor =
    user.role === "ADMIN"    ? "from-red-500 to-rose-600"       :
    user.role === "LECTURER" ? "from-blue-600 to-indigo-600"    :
                               "from-emerald-500 to-teal-600";

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-white animate-slide-in-left">

      {/* Logo header */}
      <div className={`flex items-center gap-3 px-5 py-5 bg-gradient-to-r ${roleColor}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold text-white leading-none">Gradely</p>
          <p className="text-xs text-white/70 mt-0.5">{roleLabel}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Navigation
        </p>
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive =
            item.href === pathname ||
            (item.href !== "/admin" && item.href !== "/lecturer" && item.href !== "/student" && pathname.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ animationDelay: `${i * 50}ms` }}
              className={cn(
                "animate-slide-in-left flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4">
        <Separator className="mb-3" />
        <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-slate-50 border">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.image ?? ""} alt={user.name} />
            <AvatarFallback className={`bg-gradient-to-br ${roleColor} text-white text-xs font-bold`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-3 mt-1 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150"
          onClick={() => signOutAction()}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
