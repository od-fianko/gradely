import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Users,
  Settings,
  GraduationCap,
  ClipboardList,
} from "lucide-react";

export type NavItem = {
  label: string;
  href:  string;
  icon:  LucideIcon;
};

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin",         icon: LayoutDashboard },
  { label: "Users",     href: "/admin/users",   icon: Users           },
  { label: "Courses",   href: "/admin/courses", icon: BookOpen        },
  { label: "Settings",  href: "/admin/settings",icon: Settings        },
];

export const lecturerNav: NavItem[] = [
  { label: "Dashboard",  href: "/lecturer",           icon: LayoutDashboard },
  { label: "My Courses", href: "/lecturer/courses",   icon: BookOpen        },
  { label: "Analytics",  href: "/lecturer/analytics", icon: BarChart3       },
];

export const studentNav: NavItem[] = [
  { label: "Dashboard",  href: "/student",         icon: LayoutDashboard },
  { label: "My Courses", href: "/student/courses", icon: GraduationCap   },
  { label: "Grades",     href: "/student/grades",  icon: ClipboardList   },
];

export const navByRole: Record<string, NavItem[]> = {
  ADMIN:    adminNav,
  LECTURER: lecturerNav,
  STUDENT:  studentNav,
};
