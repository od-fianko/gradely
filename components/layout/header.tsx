"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, User, Menu } from "lucide-react";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { NotificationsPopover } from "@/features/notifications/components/notifications-popover";
import { SidebarContent, type SidebarUser, type SidebarCourse } from "@/components/layout/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderUser = SidebarUser;

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

export function Header({ user, courses }: { user: HeaderUser; courses: SidebarCourse[] }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Close the mobile drawer whenever navigation happens
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Derive a section title from the path: /lecturer/courses/... -> "Courses"
  const segments = pathname.split("/").filter(Boolean);
  const section  = segments[1] ?? "";
  const title    = SECTION_TITLES[section] ?? "Dashboard";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:px-6">

      <div className="flex items-center gap-2">
        {/* Mobile: hamburger opens the sidebar as a drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden -ml-1">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-slate-800 bg-slate-900 [&>button]:text-slate-400">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent user={user} courses={courses} />
          </SheetContent>
        </Sheet>

        <h1 className="text-sm font-semibold text-slate-700">{title}</h1>
      </div>

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
