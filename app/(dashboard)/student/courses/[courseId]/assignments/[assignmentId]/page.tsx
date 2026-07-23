import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { Clock, Award, Code2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmissionForm } from "@/features/assignments/components/submission-form";
import { StartAttempt } from "@/features/assignments/components/start-attempt";
import { GradeCard } from "@/features/assignments/components/grade-card";

export const metadata: Metadata = { title: "Assignment — Gradely" };

export default async function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { courseId, assignmentId } = await params;

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: session.user.id, courseId } },
  });
  if (!enrollment) notFound();

  const assignment = await prisma.assignment.findUnique({
    where:   { id: assignmentId, isPublished: true },
    include: {
      course:             { select: { code: true, title: true } },
      shortAnswerDetails:  true,
      fileUploadDetails:   true,
      programmingDetails:  { select: { starterCode: true } },
      quizDetails:        {
        include: {
          questions: {
            include: { options: { orderBy: { order: "asc" } } },
            orderBy: { order: "asc" },
          },
        },
      },
      submissions: {
        where:   { studentId: session.user.id },
        include: {
          grade:                 true,
          shortAnswerSubmission: true,
          codeSubmission:        true,
          fileSubmission:        true,
          quizSubmission:        { include: { answers: { include: { selectedOption: true } } } },
        },
        take: 1,
      },
    },
  });
  if (!assignment) notFound();

  const rawExisting = assignment.submissions[0] ?? null;
  const releasedGrade = rawExisting?.grade?.isReleased ? rawExisting.grade : null;
  const existing = rawExisting ? { ...rawExisting, grade: releasedGrade } : null;
  const gradePendingReview = !!rawExisting?.grade && !rawExisting.grade.isReleased;
  const due      = new Date(assignment.dueDate);
  const overdue  = isPast(due);
  const canSubmit = !overdue || assignment.allowLateSubmit;

  const timed      = !!assignment.timeLimitMinutes;
  const needsStart = timed && !existing?.startedAt && !existing?.submittedAt;
  const deadline   = timed && existing?.startedAt && !existing?.submittedAt
    ? new Date(existing.startedAt.getTime() + assignment.timeLimitMinutes! * 60_000).toISOString()
    : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto w-full">

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/student/courses" className="hover:text-blue-600 transition-colors">Courses</Link>
        <span>/</span>
        <Link href={`/student/courses/${courseId}`} className="hover:text-blue-600 transition-colors">
          {assignment.course.code}
        </Link>
        <span>/</span>
        <span className="text-foreground/90 font-medium truncate">{assignment.title}</span>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
            {assignment.type.replace("_", " ")}
          </Badge>
          {overdue && !existing && <Badge variant="destructive">Overdue</Badge>}
          {existing?.grade && <Badge className="bg-emerald-500">Graded</Badge>}
          {gradePendingReview && <Badge variant="secondary">Grading in review</Badge>}
        </div>
        <h1 className="text-2xl font-bold text-foreground">{assignment.title}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">{assignment.description}</p>
        <p className={`text-xs mt-1 flex items-center gap-1.5 ${overdue ? "text-red-500" : "text-muted-foreground"}`}>
          <Clock className="h-3 w-3" />
          {overdue ? "Was due" : "Due"} {format(due, "dd MMM yyyy, h:mm a")}
          · {assignment.totalMarks} marks
          {assignment.timeLimitMinutes ? ` · ⏱ ${assignment.timeLimitMinutes} min` : ""}
        </p>
      </div>

      {existing?.integrityFlagged && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-red-700">⚠ Academic integrity notice</p>
            <p className="text-xs text-red-600 mt-1">
              Your submission was flagged as possibly AI-generated or copied
              {existing.integrityScore != null ? ` (${existing.integrityScore}% confidence)` : ""}.
              Your lecturer has been notified. If this is your own work, please discuss it with your lecturer.
              You can update your submission with your own attempt at any time before the deadline.
            </p>
          </CardContent>
        </Card>
      )}

      {gradePendingReview && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-amber-700">Your submission was auto-graded</p>
            <p className="text-xs text-amber-600 mt-1">
              Your lecturer reviews auto-graded scores before releasing them. You&apos;ll be notified once your grade is available.
            </p>
          </CardContent>
        </Card>
      )}

      {existing?.grade && (
        <GradeCard grade={existing.grade} totalMarks={assignment.totalMarks} />
      )}

      {canSubmit ? (
        assignment.type === "PROGRAMMING" ? (
          <Card className="border-primary/20">
            <CardContent className="py-10 flex flex-col items-center text-center gap-3">
              <div className="rounded-full bg-primary/10 p-3">
                <Code2 className="h-7 w-7 text-primary" />
              </div>
              <p className="font-semibold text-lg">
                {existing ? "Continue your attempt" : "Ready to start coding?"}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                This opens a dedicated coding workspace with an editor, test runner, and an AI tutor
                that gives hints — not answers.
              </p>
              <Button asChild size="lg" className="mt-2 gap-2">
                <Link href={`/attempt/${assignment.id}`}>
                  {existing ? "Resume Workspace" : "Open Coding Workspace"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : needsStart ? (
          <StartAttempt assignmentId={assignment.id} minutes={assignment.timeLimitMinutes!} />
        ) : (
        <SubmissionForm
          assignment={{
            id:          assignment.id,
            type:        assignment.type,
            totalMarks:  assignment.totalMarks,
            quizDetails: assignment.quizDetails as any,
            starterCode: assignment.programmingDetails?.starterCode ?? null,
          }}
          existing={existing}
          courseId={courseId}
          deadline={deadline}
        />
        )
      ) : (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium text-orange-700">Submission deadline has passed.</p>
            <p className="text-xs text-orange-600 mt-1">Late submissions are not allowed for this assignment.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
