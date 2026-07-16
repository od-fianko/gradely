import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import { BarChart3, Users, TrendingUp, ClipboardCheck, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Analytics — Gradely" };

export default async function LecturerAnalyticsPage() {
  const session = await requireRole("LECTURER");

  const courses = await prisma.course.findMany({
    where:   { lecturerId: session.user.id },
    include: {
      _count:      { select: { enrollments: true, assignments: true } },
      assignments: {
        include: {
          _count:      { select: { submissions: true } },
          submissions: { include: { grade: true } },
        },
      },
    },
  });

  const totalStudents    = courses.reduce((s, c) => s + c._count.enrollments, 0);
  const totalAssignments = courses.reduce((s, c) => s + c._count.assignments, 0);

  const allGrades = courses.flatMap((c) => c.assignments.flatMap((a) => a.submissions.flatMap((s) => s.grade ? [s.grade.percentage] : [])));
  const overallAvg = allGrades.length ? Math.round(allGrades.reduce((s, p) => s + p, 0) / allGrades.length) : null;

  const allSubmissions  = courses.flatMap((c) => c.assignments.flatMap((a) => a.submissions));
  const pendingGrading  = allSubmissions.filter((s) => !s.grade && (s.status === "SUBMITTED" || s.status === "LATE_SUBMITTED")).length;

  const courseStats = courses.map((c) => {
    const grades   = c.assignments.flatMap((a) => a.submissions.flatMap((s) => s.grade ? [s.grade.percentage] : []));
    const avg      = grades.length ? Math.round(grades.reduce((s, p) => s + p, 0) / grades.length) : null;
    const subs     = c.assignments.reduce((s, a) => s + a._count.submissions, 0);
    return { ...c, avg, subs };
  });

  function scoreColor(pct: number | null) {
    if (pct === null) return "text-slate-400";
    if (pct >= 70) return "text-emerald-600";
    if (pct >= 50) return "text-amber-600";
    return "text-red-600";
  }

  return (
    <div className="space-y-6 animate-fade-in">

      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-500" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Performance overview across all your courses
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Students",    value: totalStudents,            icon: Users,          color: "text-blue-500",    bg: "bg-blue-50",    border: "border-t-blue-400"    },
          { label: "Total Assignments", value: totalAssignments,         icon: ClipboardCheck, color: "text-purple-500",  bg: "bg-purple-50",  border: "border-t-purple-400"  },
          { label: "Overall Average",   value: overallAvg ? `${overallAvg}%` : "—", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50", border: "border-t-emerald-400" },
          { label: "Pending Grading",   value: pendingGrading,           icon: BookOpen,       color: "text-orange-500",  bg: "bg-orange-50",  border: "border-t-orange-400"  },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <Card key={label} className={`border-t-4 ${border} shadow-sm hover:shadow-md transition-all`}>
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${bg} ${color}`}><Icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-course breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Course Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {courseStats.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No courses yet. Create a course to see analytics.
            </div>
          ) : (
            <div className="divide-y">
              {courseStats.map((c) => (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{c.code}</span>
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.semester}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center">
                      <p className="font-bold text-slate-700">{c._count.enrollments}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-700">{c._count.assignments}</p>
                      <p className="text-xs text-muted-foreground">Assignments</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-700">{c.subs}</p>
                      <p className="text-xs text-muted-foreground">Submissions</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${scoreColor(c.avg)}`}>{c.avg !== null ? `${c.avg}%` : "—"}</p>
                      <p className="text-xs text-muted-foreground">Avg Grade</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  {c.avg !== null && (
                    <div className="w-full mt-1">
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${c.avg >= 70 ? "bg-emerald-500" : c.avg >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${c.avg}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-assignment detail for each course */}
      {courseStats.map((c) =>
        c.assignments.length === 0 ? null : (
          <Card key={`detail-${c.id}`}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">{c.code}</span>
                Assignment Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {c.assignments.map((a) => {
                  const grades    = a.submissions.filter((s) => s.grade).map((s) => s.grade!.percentage);
                  const avg       = grades.length ? Math.round(grades.reduce((s, p) => s + p, 0) / grades.length) : null;
                  const submitted = a._count.submissions;
                  const graded    = a.submissions.filter((s) => s.grade).length;
                  return (
                    <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.type.replace("_", " ")}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs shrink-0">
                        <span className="text-slate-600">{submitted} submitted</span>
                        <span className="text-slate-600">{graded} graded</span>
                        <Badge variant="outline" className={`${avg !== null && avg >= 70 ? "text-emerald-600 border-emerald-200 bg-emerald-50" : avg !== null && avg >= 50 ? "text-amber-600 border-amber-200 bg-amber-50" : "text-slate-500"}`}>
                          {avg !== null ? `${avg}% avg` : "No grades"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
