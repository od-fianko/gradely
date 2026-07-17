import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Users, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AssignmentRow } from "@/features/assignments/components/assignment-row";
import { AnnouncementsSection } from "@/features/courses/components/announcements-section";

export const metadata: Metadata = { title: "Course — Gradely" };

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session      = await requireRole("STUDENT");
  const { courseId } = await params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: session.user.id, courseId } },
  });
  if (!enrollment) notFound();

  const course = await prisma.course.findUnique({
    where:   { id: courseId },
    include: {
      lecturer: { select: { name: true, email: true } },
      assignments: {
        where:   { isPublished: true },
        include: {
          _count: { select: { submissions: true } },
          submissions: {
            where:   { studentId: session.user.id },
            include: { grade: true },
            take:    1,
          },
        },
        orderBy: { dueDate: "asc" },
      },
      announcements: {
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take:    10,
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) notFound();

  const assignmentsWithGrade = course.assignments.map((a) => ({
    ...a,
    grade: a.submissions[0]?.grade ?? null,
  }));

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/student/courses" className="hover:text-blue-600 transition-colors">Courses</Link>
        <span>/</span>
        <span className="text-foreground/90 font-medium">{course.code}</span>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="font-mono text-blue-600 border-blue-200 bg-blue-50">
            {course.code}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>
        {course.description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">{course.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {course.semester} · {course.lecturer.name}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Students",    value: course._count.enrollments,         icon: Users },
          { label: "Assignments", value: course.assignments.length,         icon: ClipboardList },
          { label: "Completed",   value: assignmentsWithGrade.filter((a) => a.grade).length, icon: BookOpen },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <div className="rounded-xl p-2.5 bg-muted/60 text-blue-500">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Assignments</h2>
        {assignmentsWithGrade.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <ClipboardList className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-muted-foreground">No assignments published yet.</p>
            </CardContent>
          </Card>
        ) : (
          assignmentsWithGrade.map((a) => (
            <AssignmentRow key={a.id} assignment={a} courseId={courseId} role="STUDENT" />
          ))
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
        canPost={false}
      />
    </div>
  );
}
