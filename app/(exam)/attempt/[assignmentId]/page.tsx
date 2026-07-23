import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { isPast } from "date-fns";
import type { Metadata } from "next";
import { CodingWorkspace } from "@/features/assignments/components/coding-workspace";
import { StartAttempt } from "@/features/assignments/components/start-attempt";

export const metadata: Metadata = { title: "Assessment — Gradely" };

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const session = await requireRole("STUDENT");
  const { assignmentId } = await params;

  const assignment = await prisma.assignment.findUnique({
    where:   { id: assignmentId, isPublished: true, type: "PROGRAMMING" },
    include: {
      course: { select: { id: true, code: true, title: true } },
      programmingDetails: {
        include: { testCases: { where: { isHidden: false }, orderBy: { order: "asc" } } },
      },
      submissions: {
        where:   { studentId: session.user.id },
        include: { grade: true, codeSubmission: { select: { code: true } } },
        take: 1,
      },
    },
  });
  if (!assignment || !assignment.programmingDetails) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: session.user.id, courseId: assignment.courseId } },
  });
  if (!enrollment) notFound();

  const existing = assignment.submissions[0] ?? null;
  const due      = new Date(assignment.dueDate);
  const overdue  = isPast(due);
  const canSubmit = !overdue || assignment.allowLateSubmit;

  const returnUrl = `/student/courses/${assignment.courseId}/assignments/${assignment.id}`;

  // Already graded, or deadline closed with no late submissions — nothing to attempt here.
  if (existing?.grade || !canSubmit) redirect(returnUrl);

  const timed      = !!assignment.timeLimitMinutes;
  const needsStart = timed && !existing?.startedAt && !existing?.submittedAt;

  if (needsStart) {
    return (
      <div className="h-full w-full flex flex-col">
        <header className="h-14 shrink-0 border-b flex items-center px-4">
          <a href={returnUrl} className="text-sm text-muted-foreground hover:text-red-600 transition-colors">
            ← Exit
          </a>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <StartAttempt assignmentId={assignment.id} minutes={assignment.timeLimitMinutes!} />
          </div>
        </div>
      </div>
    );
  }

  // Timed assignments are guaranteed a submission row by now (created by /start).
  // Untimed assignments never go through that gate, so create one transparently
  // on first visit — there's nothing to "start", the workspace just needs
  // somewhere to attach code and test runs.
  const submission = existing ?? await prisma.submission.upsert({
    where:  { studentId_assignmentId: { studentId: session.user.id, assignmentId: assignment.id } },
    update: {},
    create: { studentId: session.user.id, assignmentId: assignment.id, status: "DRAFT" },
    include: { grade: true, codeSubmission: { select: { code: true } } },
  });

  const deadline = timed && submission.startedAt
    ? new Date(submission.startedAt.getTime() + assignment.timeLimitMinutes! * 60_000).toISOString()
    : null;

  const pd = assignment.programmingDetails;
  const hiddenTestCount = await prisma.testCase.count({
    where: { programmingAssignmentId: pd.id, isHidden: true },
  });

  return (
    <CodingWorkspace
      assignment={{
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        courseId: assignment.course.id,
        courseCode: assignment.course.code,
        courseTitle: assignment.course.title,
        totalMarks: assignment.totalMarks,
        timeLimitMinutes: assignment.timeLimitMinutes,
        language: pd.language,
        difficulty: pd.difficulty,
        timeLimitSeconds: pd.timeLimit,
        memoryLimitMB: pd.memoryLimit,
        hiddenTestCount,
        testCases: pd.testCases.map((tc) => ({
          id: tc.id, title: tc.title, input: tc.input, expectedOutput: tc.expectedOutput,
        })),
      }}
      submissionId={submission.id}
      initialCode={submission.codeSubmission?.code ?? pd.starterCode ?? ""}
      deadline={deadline}
      overdue={overdue}
    />
  );
}
