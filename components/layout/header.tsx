"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { NotificationsPopover } from "@/features/notifications/components/notifications-popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderUser = {
  name:  string;
  email: string;
  role:  string;
  image: string | null;
};

const ROLE_PILL: Record<string, string> = {
  ADMIN:    "bg-red-100 text-red-700 ring-1 ring-red-200",
  LECTURER: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  STUDENT:  "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", LECTURER: "Lecturer", STUDENT: "Student",
};

const ROLE_GRADIENT: Record<string, string> = {
  ADMIN:    "from-red-500 to-rose-600",
  LECTURER: "from-blue-600 to-indigo-600",
  STUDENT:  "from-emerald-500 to-teal-600",
};

export function Header({ user }: { user: HeaderUser }) {
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-6 shadow-sm animate-fade-in">

      {/* Left — page title area (breadcrumbs added later) */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs text-muted-foreground font-medium">Live</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <NotificationsPopover />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 hover:bg-slate-100 transition-all duration-150 rounded-xl"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.image ?? ""} alt={user.name} />
                <AvatarFallback className={`bg-gradient-to-br ${ROLE_GRADIENT[user.role] ?? "from-slate-400 to-slate-500"} text-white text-xs font-bold`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-semibold leading-tight">{user.name}</span>
              </div>
              <span className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_PILL[user.role] ?? ""}`}>
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-slate-200">
            <DropdownMenuLabel className="font-normal px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <p className="font-semibold text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <span className={`inline-flex self-start items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${ROLE_PILL[user.role] ?? ""}`}>
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-lg mx-1 cursor-pointer">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 rounded-lg mx-1 mb-1 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              onClick={() => signOutAction()}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
