import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EditAssignmentForm } from "@/features/assignments/components/edit-assignment-form";

export const metadata: Metadata = { title: "Edit Assignment — Gradely" };

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const session = await requireRole("LECTURER");
  const { courseId, assignmentId } = await params;

  const assignment = await prisma.assignment.findUnique({
    where:   { id: assignmentId },
    include: {
      course:             { select: { id: true, code: true, title: true, lecturerId: true } },
      programmingDetails: { select: {
        starterCode: true, difficulty: true, tags: true, autoGrade: true, functionName: true,
        referenceSolution: true, similarityCheckEnabled: true, similarityThreshold: true, requireManualReview: true,
      } },
      projectDetails: { select: {
        brief: true, functionalRequirements: true, deliverables: true, rubric: true,
        githubRequired: true, allowedFileTypes: true, maxFileSizeMB: true,
      } },
      shortAnswerDetails: { select: { rubric: true, sampleAnswer: true, wordLimit: true } },
      fileUploadDetails:  { select: { allowedFileTypes: true, maxFileSizeMB: true, rubric: true } },
      quizDetails:        { select: { shuffleQuestions: true, shuffleOptions: true, timeLimit: true, _count: { select: { questions: true } } } },
      _count: { select: { submissions: true } },
    },
  });
  if (!assignment || assignment.course.lecturerId !== session.user.id) notFound();

  return (
    <div className="max-w-3xl animate-fade-in">
      <EditAssignmentForm assignment={assignment} courseId={courseId} />
    </div>
  );
}
