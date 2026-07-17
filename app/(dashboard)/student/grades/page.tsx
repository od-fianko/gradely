import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Trophy, Star, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "My Grades — Gradely" };

export default async function StudentGradesPage() {
  const session = await requireRole("STUDENT");

  const grades = await prisma.grade.findMany({
    where: { submission: { studentId: session.user.id } },
    include: {
      submission: {
        include: {
          assignment: {
            select: {
              id:        true,
              title:     true,
              type:      true,
              totalMarks: true,
              courseId:  true,
              course:    { select: { code: true, title: true } },
            },
          },
        },
      },
    },
    orderBy: { gradedAt: "desc" },
  });

  const avg = grades.length
    ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length)
    : null;

  const passed = grades.filter((g) => g.percentage >= 50).length;

  return (
    <div className="space-y-6 animate-fade-in">

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" /> My Grades
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {grades.length} graded assignment{grades.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Average Grade",    value: avg ? `${avg}%` : "—",         icon: Star,          color: "text-yellow-500" },
          { label: "Graded",           value: grades.length,                  icon: CheckCircle2,  color: "text-blue-500"   },
          { label: "Passed (≥ 50%)",   value: passed,                         icon: Trophy,        color: "text-emerald-500"},
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <div className={`rounded-xl p-2.5 bg-muted/60 ${color}`}><Icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {grades.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-2">
            <Trophy className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-muted-foreground">No grades yet</p>
            <p className="text-xs text-muted-foreground">Submit assignments and wait for your lecturer to grade them.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {grades.map((g) => {
            const a = g.submission.assignment;
            return (
              <Link key={g.id}
                href={`/student/courses/${a.courseId}/assignments/${a.id}`}
                className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 hover:shadow-md hover:border-blue-200 transition-all duration-200 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-foreground truncate group-hover:text-blue-600 transition-colors">
                      {a.title}
                    </p>
                    <span className="text-xs text-muted-foreground">{a.course.code}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>Graded {format(new Date(g.gradedAt), "dd MMM yyyy")}</span>
                    <span>·</span>
                    <span>{a.type.replace("_", " ")}</span>
                  </div>
                </div>
                <Badge className={`text-sm font-bold shrink-0 ${
                  g.percentage >= 70 ? "bg-emerald-500 hover:bg-emerald-600"
                  : g.percentage >= 50 ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-red-500 hover:bg-red-600"
                }`}>
                  {g.score}/{g.maxScore} · {g.percentage.toFixed(0)}%
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
