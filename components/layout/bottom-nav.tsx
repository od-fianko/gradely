"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navByRole, type NavItem } from "./nav-items";
import { cn } from "@/lib/utils/cn";

/** Mobile-only bottom tab bar (Duolingo-style primary navigation). */
export function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const navItems: NavItem[] = navByRole[role] ?? [];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
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
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label.replace("My ", "")}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
