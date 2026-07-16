import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Users, ClipboardList, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssignmentRow } from "@/features/assignments/components/assignment-row";
import { AnnouncementsSection } from "@/features/courses/components/announcements-section";

export const metadata: Metadata = { title: "Course — Gradely" };

export default async function LecturerCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session    = await requireRole("LECTURER");
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where:   { id: courseId, lecturerId: session.user.id },
    include: {
      assignments: {
        include: { _count: { select: { submissions: true } } },
        orderBy:  { dueDate: "asc" },
      },
      announcements: {
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take:    10,
      },
      _count: { select: { enrollments: true, assignments: true } },
    },
  });
  if (!course) notFound();

  const now = new Date();
  const upcoming = course.assignments.filter((a) => a.dueDate > now && a.isPublished);
  const past     = course.assignments.filter((a) => a.dueDate <= now || !a.isPublished);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/lecturer/courses" className="hover:text-blue-600 transition-colors">Courses</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{course.code}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono text-blue-600 border-blue-200 bg-blue-50">
              {course.code}
            </Badge>
            {!course.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{course.title}</h1>
          {course.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-lg">{course.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{course.semester}</p>
        </div>
        <Link href={`/lecturer/courses/${courseId}/assignments/new`}>
          <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> New Assignment
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Students", value: course._count.enrollments, icon: Users,         color: "text-emerald-500" },
          { label: "Assignments", value: course._count.assignments, icon: ClipboardList, color: "text-blue-500"    },
          { label: "Due soon", value: upcoming.length,          icon: Clock,          color: "text-orange-500"  },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <div className={`rounded-xl p-2.5 bg-slate-50 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assignments */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Assignments</h2>

        {course.assignments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No assignments yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Create an assignment for students to complete.</p>
              <Link href={`/lecturer/courses/${courseId}/assignments/new`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-3.5 w-3.5" /> Create first assignment
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {course.assignments.map((a) => (
              <AssignmentRow
                key={a.id}
                assignment={a}
                courseId={courseId}
                role="LECTURER"
              />
            ))}
          </div>
        )}
      </div>

      {/* Announcements */}
      <AnnouncementsSection
        courseId={courseId}
        announcements={course.announcements.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          author: { name: a.author.name ?? "Unknown", role: a.author.role },
        }))}
        canPost={true}
      />
    </div>
  );
}
