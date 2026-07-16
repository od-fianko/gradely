import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Users, BookOpen, GraduationCap, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin Dashboard — Gradely" };

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");

  const [totalUsers, totalCourses, totalStudents, totalLecturers, recentUsers] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "LECTURER" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
  ]);

  const stats = [
    { label: "Total Users",      value: totalUsers,     icon: Users,         light: "bg-blue-50 text-blue-600",    border: "border-t-blue-500"    },
    { label: "Total Courses",    value: totalCourses,   icon: BookOpen,      light: "bg-green-50 text-green-600",  border: "border-t-green-500"   },
    { label: "Total Students",   value: totalStudents,  icon: GraduationCap, light: "bg-purple-50 text-purple-600",border: "border-t-purple-500"  },
    { label: "Active Lecturers", value: totalLecturers, icon: ShieldCheck,   light: "bg-orange-50 text-orange-600",border: "border-t-orange-500"  },
  ];

  const ROLE_COLOR: Record<string, string> = {
    ADMIN:    "bg-red-100 text-red-700",
    LECTURER: "bg-blue-100 text-blue-700",
    STUDENT:  "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 via-rose-600 to-pink-600 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-64 opacity-10">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <circle cx="150" cy="50"  r="80" fill="white" />
            <circle cx="50"  cy="150" r="60" fill="white" />
          </svg>
        </div>
        <p className="text-sm font-medium text-red-200">Platform overview</p>
        <h1 className="mt-1 text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-red-200">Manage users, courses, and platform settings.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} style={{ animationDelay: `${i * 80}ms` }}
              className={`animate-slide-up border-t-4 ${stat.border} hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <div className={`rounded-xl p-2.5 ${stat.light}`}><Icon className="h-4 w-4" /></div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" /> Recent Users
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`text-xs ${ROLE_COLOR[u.role]}`} variant="outline">
                    {u.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {format(new Date(u.createdAt), "dd MMM yyyy")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
