"use client";

import Link from "next/link";
import { LayoutDashboard, ClipboardList, BarChart3, Sparkles, Settings, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface BuilderCourse { id: string; code: string; title: string }

interface Props {
  activeCourseId: string;
  courses: BuilderCourse[];
}

/**
 * Dedicated left nav for the full-screen assessment builder — distinct from
 * the regular dashboard sidebar since this is its own focused workspace.
 */
export function BuilderSidebar({ activeCourseId, courses }: Props) {
  const navItems = [
    { label: "Dashboard",   href: "/lecturer",                            icon: LayoutDashboard },
    { label: "Assessments", href: `/lecturer/courses/${activeCourseId}`,  icon: ClipboardList, active: true },
    { label: "Gradebook",   href: "/lecturer/analytics",                  icon: BarChart3 },
  ];

  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold leading-none">Gradely</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Academic Excellence</p>
        </div>
      </div>

      <nav className="p-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                item.active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}>
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/50 cursor-default">
          <Sparkles className="h-4 w-4 shrink-0" />
          AI Tutor
          <span className="ml-auto text-[10px] font-semibold bg-muted px-1.5 py-0.5 rounded">SOON</span>
        </div>
      </nav>

      <div className="px-3 pt-2">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Question Bank
        </p>
        <div className="space-y-0.5">
          {courses.map((c) => (
            <Link key={c.id} href={`/lecturer/courses/${c.id}`}
              title={c.title}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors truncate",
                c.id === activeCourseId ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}>
              <span className="font-mono text-xs shrink-0">{c.code}</span>
              <span className="truncate text-xs">{c.title}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto p-3 border-t">
        <Link href="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
