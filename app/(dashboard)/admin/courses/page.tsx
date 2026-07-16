import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Courses — Admin" };

export default async function AdminCoursesPage() {
  await requireRole("ADMIN");

  const courses = await prisma.course.findMany({
    include: {
      lecturer: { select: { name: true, email: true } },
      _count:   { select: { enrollments: true, assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-red-500" /> All Courses
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{courses.length} courses on the platform</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {courses.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No courses yet.</div>
          ) : (
            <div className="divide-y">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{c.code}</span>
                      {!c.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.lecturer.name} · {c.semester}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span>{c._count.enrollments} students</span>
                    <span>{c._count.assignments} assignments</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
