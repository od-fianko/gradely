import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateAssignmentForm } from "@/features/assignments/components/create-assignment-form";

export const metadata: Metadata = { title: "New Assignment — Gradely" };

export default async function NewAssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session      = await requireRole("LECTURER");
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where:  { id: courseId, lecturerId: session.user.id },
    select: { id: true, code: true, title: true },
  });
  if (!course) notFound();

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/lecturer/courses" className="hover:text-blue-600 transition-colors">Courses</Link>
        <span>/</span>
        <Link href={`/lecturer/courses/${courseId}`} className="hover:text-blue-600 transition-colors">
          {course.code}
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">New Assignment</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Create Assignment</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{course.title}</p>
      </div>

      <CreateAssignmentForm courseId={courseId} />
    </div>
  );
}
