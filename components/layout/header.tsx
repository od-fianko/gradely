"use client";

import { usePathname } from "next/navigation";
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

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", LECTURER: "Lecturer", STUDENT: "Student",
};

const SECTION_TITLES: Record<string, string> = {
  "":            "Dashboard",
  "courses":     "Courses",
  "grades":      "Grades",
  "analytics":   "Analytics",
  "users":       "Users",
  "settings":    "Settings",
  "assignments": "Assignments",
};

export function Header({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Derive a section title from the path: /lecturer/courses/... -> "Courses"
  const segments = pathname.split("/").filter(Boolean);
  const section  = segments[1] ?? "";
  const title    = SECTION_TITLES[section] ?? "Dashboard";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">

      <h1 className="text-sm font-semibold text-slate-700">{title}</h1>

      <div className="flex items-center gap-1">
        <NotificationsPopover />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2 h-9">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.image ?? ""} alt={user.name} />
                <AvatarFallback className="bg-primary text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium">{user.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="font-semibold text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role] ?? user.role}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
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
