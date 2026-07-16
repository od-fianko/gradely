import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { format, addDays, isPast } from "date-fns";
import { BookOpen, Users, ClipboardCheck, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard — Gradely" };

export default async function LecturerDashboardPage() {
  const session   = await requireRole("LECTURER");
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const [courses, pendingSubmissions, dueSoon] = await Promise.all([
    prisma.course.findMany({
      where:   { lecturerId: session.user.id, isActive: true },
      include: { _count: { select: { enrollments: true } } },
    }),
    prisma.submission.findMany({
      where: {
        assignment: { course: { lecturerId: session.user.id } },
        grade:      null,
        status:     { in: ["SUBMITTED", "LATE_SUBMITTED"] },
      },
      include: {
        student:    { select: { name: true } },
        assignment: { select: { id: true, title: true, courseId: true } },
      },
      orderBy: { submittedAt: "desc" },
      take:    10,
    }),
    prisma.assignment.findMany({
      where: {
        course:      { lecturerId: session.user.id },
        isPublished: true,
        dueDate:     { gte: new Date(), lte: addDays(new Date(), 7) },
      },
      include: { course: { select: { code: true } } },
      orderBy: { dueDate: "asc" },
      take:    5,
    }),
  ]);

  const totalStudents = courses.reduce((s, c) => s + c._count.enrollments, 0);

  const stats = [
    { label: "Active Courses",        value: courses.length,              icon: BookOpen,       gradient: "from-blue-500 to-blue-600",       light: "bg-blue-50 text-blue-600",       border: "border-t-blue-500"    },
    { label: "Total Students",        value: totalStudents,               icon: Users,          gradient: "from-emerald-500 to-teal-600",    light: "bg-emerald-50 text-emerald-600", border: "border-t-emerald-500" },
    { label: "Pending Submissions",   value: pendingSubmissions.length,   icon: ClipboardCheck, gradient: "from-orange-500 to-amber-500",    light: "bg-orange-50 text-orange-600",   border: "border-t-orange-500"  },
    { label: "Due This Week",         value: dueSoon.length,             icon: Clock,          gradient: "from-purple-500 to-indigo-600",   light: "bg-purple-50 text-purple-600",   border: "border-t-purple-500"  },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-64 opacity-10">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <circle cx="150" cy="50" r="80" fill="white" />
            <circle cx="50" cy="150" r="60" fill="white" />
          </svg>
        </div>
        <p className="text-sm font-medium text-blue-200">Good day,</p>
        <h1 className="mt-1 text-2xl font-bold">{session.user.name}</h1>
        <p className="mt-1 text-sm text-blue-200">Here is an overview of your courses and student activity.</p>
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
              <ClipboardCheck className="h-4 w-4 text-orange-500" /> Pending Submissions
            </CardTitle>
            {pendingSubmissions.length > 0 && (
              <Link href="/lecturer/courses" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {pendingSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardCheck className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">All caught up! No pending submissions.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingSubmissions.slice(0, 5).map((sub) => (
                  <Link key={sub.id}
                    href={`/lecturer/courses/${sub.assignment.courseId}/assignments/${sub.assignment.id}`}
                    className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2.5 hover:bg-white hover:shadow-sm transition-all text-sm group">
                    <div>
                      <p className="font-medium text-slate-700 group-hover:text-blue-600 transition-colors">{sub.student.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-48">{sub.assignment.title}</p>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-xs ml-2 shrink-0">Grade</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" /> Due This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dueSoon.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No assignments due this week.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dueSoon.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-700 truncate max-w-48">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.course.code}</p>
                    </div>
                    <span className="text-xs text-purple-600 font-medium shrink-0 ml-2">
                      {format(new Date(a.dueDate), "dd MMM")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
