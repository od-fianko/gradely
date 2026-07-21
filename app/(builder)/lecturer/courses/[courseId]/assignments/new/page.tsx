import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CreateAssignmentForm } from "@/features/assignments/components/create-assignment-form";

export const metadata: Metadata = { title: "New Assessment — Gradely" };

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

  const lecturerCourses = await prisma.course.findMany({
    where:   { lecturerId: session.user.id, isActive: true },
    select:  { id: true, code: true, title: true },
    orderBy: { code: "asc" },
  });

  return (
    <CreateAssignmentForm
      courseId={courseId}
      courseCode={course.code}
      courseTitle={course.title}
      lecturerCourses={lecturerCourses}
    />
  );
}
