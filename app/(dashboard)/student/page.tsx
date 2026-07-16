import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { GraduationCap, ClipboardList, Star, Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard — Gradely" };

export default async function StudentDashboardPage() {
  const session = await requireRole("STUDENT");

  const [enrollments, upcomingAssignments, recentGrades] = await Promise.all([
    prisma.enrollment.findMany({
      where:   { studentId: session.user.id },
      include: { course: { select: { code: true, title: true } } },
    }),
    prisma.assignment.findMany({
      where: {
        isPublished: true,
        dueDate:     { gte: new Date(), lte: addDays(new Date(), 14) },
        course:      { enrollments: { some: { studentId: session.user.id } } },
        NOT:         { submissions: { some: { studentId: session.user.id, status: { in: ["SUBMITTED", "LATE_SUBMITTED"] } } } },
      },
      include: { course: { select: { id: true, code: true } } },
      orderBy: { dueDate: "asc" },
      take:    6,
    }),
    prisma.grade.findMany({
      where:   { submission: { studentId: session.user.id } },
      include: {
        submission: {
          include: {
            assignment: { select: { id: true, title: true, courseId: true, course: { select: { code: true } } } },
          },
        },
      },
      orderBy: { gradedAt: "desc" },
      take:    5,
    }),
  ]);

  const avgGrade = recentGrades.length
    ? Math.round(recentGrades.reduce((s, g) => s + g.percentage, 0) / recentGrades.length)
    : null;

  const stats = [
    { label: "Enrolled Courses",     value: enrollments.length,         icon: GraduationCap, light: "bg-blue-50 text-blue-600",    border: "border-t-blue-500"    },
    { label: "Pending Assignments",  value: upcomingAssignments.length, icon: ClipboardList, light: "bg-orange-50 text-orange-600", border: "border-t-orange-500"  },
    { label: "Average Grade",        value: avgGrade ? `${avgGrade}%` : "—", icon: Star,    light: "bg-yellow-50 text-yellow-600", border: "border-t-yellow-500"  },
    { label: "Due Next 2 Weeks",     value: upcomingAssignments.length, icon: Calendar,     light: "bg-purple-50 text-purple-600", border: "border-t-purple-500"  },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-64 opacity-10">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <circle cx="150" cy="50" r="80" fill="white" />
            <circle cx="50" cy="150" r="60" fill="white" />
          </svg>
        </div>
        <p className="text-sm font-medium text-emerald-200">Hello,</p>
        <h1 className="mt-1 text-2xl font-bold">{session.user.name}</h1>
        <p className="mt-1 text-sm text-emerald-200">Here is a summary of your coursework, deadlines and grades.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-orange-500" /> Upcoming Assignments
            </CardTitle>
            <Link href="/student/courses" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              All courses <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No upcoming assignments — you are all caught up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingAssignments.map((a) => (
                  <Link key={a.id}
                    href={`/student/courses/${a.course.id}/assignments/${a.id}`}
                    className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2.5 hover:bg-white hover:shadow-sm transition-all text-sm group">
                    <div>
                      <p className="font-medium text-slate-700 group-hover:text-blue-600 transition-colors truncate max-w-48">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.course.code}</p>
                    </div>
                    <span className="text-xs text-orange-600 font-medium shrink-0 ml-2">
                      {format(new Date(a.dueDate), "dd MMM")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" /> Recent Grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentGrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Star className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No grades yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentGrades.map((g) => (
                  <Link key={g.id}
                    href={`/student/courses/${g.submission.assignment.courseId}/assignments/${g.submission.assignment.id}`}
                    className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2.5 hover:bg-white hover:shadow-sm transition-all text-sm group">
                    <div>
                      <p className="font-medium text-slate-700 group-hover:text-blue-600 transition-colors truncate max-w-48">
                        {g.submission.assignment.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{g.submission.assignment.course.code}</p>
                    </div>
                    <Badge className={`text-xs shrink-0 ml-2 ${g.percentage >= 70 ? "bg-emerald-500" : g.percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
                      {g.percentage.toFixed(0)}%
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
