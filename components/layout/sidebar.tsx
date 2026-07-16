"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { navByRole, type NavItem } from "./nav-items";
import { cn } from "@/lib/utils/cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SidebarUser = {
  name:  string;
  email: string;
  role:  string;
  image: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN:    "Administrator",
  LECTURER: "Lecturer",
  STUDENT:  "Student",
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

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-slate-300">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-slate-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shrink-0">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-none tracking-tight">Gradely</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{ROLE_LABEL[user.role] ?? user.role}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === pathname ||
            (item.href !== "/admin" && item.href !== "/lecturer" && item.href !== "/student" && pathname.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative",
                isActive
                  ? "bg-slate-800 text-white font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.image ?? ""} alt={user.name} />
            <AvatarFallback className="bg-slate-700 text-slate-200 text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate leading-none">{user.name}</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={() => signOutAction()}
            title="Sign out"
            className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
